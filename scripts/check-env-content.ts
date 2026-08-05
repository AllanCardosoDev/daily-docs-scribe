import fs from "fs";
import path from "path";

const envFiles = [".env", ".env.local", ".env.production"];
for (const file of envFiles) {
  const fullPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    console.log(`\n📄 Encontrado arquivo: ${file}`);
    const content = fs.readFileSync(fullPath, "utf-8");
    console.log(content.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#")).join("\n"));
  }
}
