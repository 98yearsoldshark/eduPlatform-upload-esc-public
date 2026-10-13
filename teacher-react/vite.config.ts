import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // server: {
  //   port: 5174,
  //   hmr: {
  //     protocol: 'ws',
  //     clientPort: 5174
  //   }
  // }
})
// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';
// import { createServer } from 'net';

// // 检查端口是否可用的函数
// function isPortAvailable(port: number): Promise<boolean> {
//     return new Promise((resolve) => {
//         const server = createServer();
//         server.once('error', () => {
//             resolve(false);
//         });
//         server.once('listening', () => {
//             server.close(() => {
//                 resolve(true);
//             });
//         });
//         server.listen(port);
//     });
// }

// // 查找可用端口的函数
// async function findAvailablePort(startPort: number, maxPort: number): Promise<number> {
//     for (let port = startPort; port <= maxPort; port++) {
//         if (await isPortAvailable(port)) {
//             return port;
//         }
//     }
//     throw new Error(`No available port found between ${startPort} and ${maxPort}`);
// }

// // 主配置函数
// export default defineConfig(async () => {
//     const startPort = 5173;
//     const maxPort = 5180;
//     const port = await findAvailablePort(startPort, maxPort);

//     return {
//         plugins: [react()],
//         server: {
//             port,
//             hmr: {
//                 protocol: 'ws',
//                 clientPort: port
//             }
//         }
//     };
// });
    
