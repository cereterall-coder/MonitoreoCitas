const http = require('http');
const { exec } = require('child_process');
const path = require('path');

const PORT = 3001; // Puerto diferente al de la App

const server = http.createServer((req, res) => {
  // CORS para permitir peticiones desde el dashboard (localhost:5173 o similar)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/actualizar') {
    console.log('🚀 Iniciando consolidación por solicitud del Dashboard...');
    
    // Ejecutar el consolidado total
    exec('node consolidate-monthly.cjs --all', { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error en consolidación: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
        return;
      }
      
      console.log('✅ Consolidación completada satisfactoriamente.');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Datos actualizados con éxito' }));
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`📡 Servidor de actualización escuchando en http://localhost:${PORT}`);
});
