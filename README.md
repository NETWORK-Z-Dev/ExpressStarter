# ExpressStarter

This library's purpose is to get rid of the default structure you usually need and create when trying to get an express server up and running in NodeJS. It works so well in fact that you can get a server up and running with only 5 lines of code, as many default variables will handle the most basic setup.

```js
import ExpressStarter from "/mnt/SSD/network-z-dev/ExpressStarter/index.mjs"
let starter = new ExpressStarter()

starter.registerErrorHandlers();
starter.registerTemplateMiddleware();
starter.startHttpServer(5000)
```

Its possible to customize many aspects of the this small library and comes with some pretty cool default features:

- Pretty terminal logging
- Build-in error handling/display
- Terminal Input handling
- Getting start-up arguments
- Check latest version from github file

You can access important parts of the library directly as well, like `starter.app`, `starter.server` and `starter.http` as in this example.

------

## Additional Docs

- [Extending templates](./docs/Template System.md)

