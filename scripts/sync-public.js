const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const files = ['index.html', 'style.css', 'app.js'];

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

for (const file of files) {
    const src = path.join(root, file);
    const dest = path.join(publicDir, file);
    if (!fs.existsSync(src)) {
        console.error(`Missing: ${file}`);
        process.exit(1);
    }
    fs.copyFileSync(src, dest);
    console.log(`Synced ${file} -> public/${file}`);
}
