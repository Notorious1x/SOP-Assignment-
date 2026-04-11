const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace signature to include next
  content = content.replace(/async \(req, res\) => {/g, 'async (req, res, next) => {');
  content = content.replace(/\(req, res\) => {/g, '(req, res, next) => {');

  // Replace specific catch block
  content = content.replace(/catch \(err\) {\s*res\.status\(500\)\.json\(\{ error: err\.message \}\);\s*}/g, 'catch (err) {\n    next(err);\n  }');

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
}
