import Server from "./server.js";

const app = await new Server()
    .init()
;

await app.start();