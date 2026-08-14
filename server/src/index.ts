import "dotenv/config";
import { networkInterfaces } from "node:os";
import { createApp } from "./app.js";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 5050);

createApp().listen(port, host, () => {
  console.log(`Trip Planner is available locally at http://127.0.0.1:${port}`);
  if (host === "0.0.0.0") {
    const addresses = Object.values(networkInterfaces())
      .flat()
      .filter((address) => address?.family === "IPv4" && !address.internal)
      .map((address) => address!.address);
    for (const address of [...new Set(addresses)])
      console.log(`Trip Planner is available on your network at http://${address}:${port}`);
  }
});
