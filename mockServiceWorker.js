self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
  console.log(
    '%cMockServiceWorker is activated!',
    'color:green;font-weight:bold;',
  )
})

self.addEventListener('message', (event) => {
  switch (event.data) {
    case 'mock-activate': {
      self.__mockActive = true
      break
    }

    case 'mock-deactivate': {
      self.__mockActive = false
      break
    }
  }
})

const sendMessageToClient = (client, message) => {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()

    channel.port1.onmessage = (event) => {
      if (event.data && event.data.error) {
        reject(event.data.error)
      } else {
        resolve(event.data)
      }
    }

    client.postMessage(JSON.stringify(message), [channel.port2])
  })
}

self.addEventListener('fetch', async (event) => {
  const { clientId, request: req } = event

  const defaultResponse = () => fetch(req)

  event.respondWith(
    new Promise(async (resolve, reject) => {
      const client = await event.target.clients.get(clientId)
      if (!client || !self.__mockActive) {
        return resolve(defaultResponse())
      }

      const reqHeaders = {}
      req.headers.forEach((value, name) => {
        reqHeaders[name] = value
      })

      const clientResponse = await sendMessageToClient(client, {
        url: req.url,
        method: req.method,
        headers: reqHeaders,
        cache: req.cache,
        mode: req.mode,
        credentials: req.credentials,
        redirect: req.redirect,
        referrer: req.referrer,
        referrerPolicy: req.referrerPolicy,
      })

      if (clientResponse === 'not-found') {
        return resolve(defaultResponse())
      }

      const res = JSON.parse(clientResponse)
      const mockedResponse = new Response(res.body, res)

      setTimeout(resolve.bind(this, mockedResponse), res.delay)
    }).catch(console.error),
  )
})