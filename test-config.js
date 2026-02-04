require('dotenv').config();
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

console.log('Before replace - token:', config.token);
console.log('ENV DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? 'SET' : 'NOT SET');

const replaceEnvVars = (obj) => {
  for (let key in obj) {
    if (typeof obj[key] === 'string' && obj[key].startsWith('${') && obj[key].endsWith('}')) {
      const envVarName = obj[key].slice(2, -1);
      console.log(`Replacing ${key}: ${obj[key]} -> ${envVarName} = ${process.env[envVarName] ? 'HAS VALUE' : 'NOT SET'}`);
      obj[key] = process.env[envVarName] || obj[key];
    }
  }
  return obj;
};

config = replaceEnvVars(config);
console.log('After replace - token starts with MTQ:', config.token.substring(0, 3));
console.log('Token matches .env:', config.token === process.env.DISCORD_BOT_TOKEN);
