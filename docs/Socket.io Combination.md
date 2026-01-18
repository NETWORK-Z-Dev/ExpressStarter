# Socket.io Combination

Its easily possible to integrate socket.io into the system by using the socket-tools library that uses the existing express server, like in hte following example with just two lines of code.

```js
import ExpressStarter from "@hackthedev/express-starter"
import SocketTools from "@hackthedev/socket-tools"

let starter = new ExpressStarter()
starter.registerErrorHandlers(); // to avoid hard crashes and enable logging
starter.registerTemplateMiddleware({ // cool template engine
                                       getPlaceholders: async (req) => {
                                           return [
                                               ["test", () => "Cool shit"]
                                           ]
                                       }
                                   });
// setup static files to serve
starter.app.use(
    starter.express.static(
        starter.dirname + "/public",
    ),
);

// begin to listen
starter.startHttpServer(5000);

// attach socket.io to existing server for real-time stuff AFTER starting it.
let socketTools = new SocketTools({expressHttpServer: starter.server});
socketTools.listen();
```





