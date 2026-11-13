// Tiny dev server used by the end-to-end fixture project. Prints a Vite-style banner so
// the port sniffer picks it up.
import { createServer } from 'node:http';

const port = Number(process.env.PORT);
createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><title>fixture</title><h1 id="fixture">HELM FIXTURE OK</h1>');
}).listen(port, '127.0.0.1', () => {
  console.log(`  ➜  Local:   http://localhost:${port}/`);
});
