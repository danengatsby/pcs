import { closePool } from "../lib/db.js";
import { seedAdminDemoData } from "../lib/adminDemoData.js";

seedAdminDemoData().then((result) => {
  console.log("Set demonstrativ administrativ încărcat:", result);
}).catch((error) => {
  console.error("Încărcarea setului demonstrativ a eșuat:", error.message);
  process.exitCode = 1;
}).finally(closePool);
