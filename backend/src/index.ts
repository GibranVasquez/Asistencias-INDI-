import { app } from "./app";

const port = Number(process.env.PORT) || 4000;

// Última red antes de que el proceso muera sin dejar rastro: sin esto, un
// throw fuera de una ruta de Express (ej. en un callback async sin catch)
// tumba el servidor sin avisarle a nadie más que la consola.
process.on("uncaughtException", (err) => {
  console.error("Excepción no capturada:", err);
  process.exit(1);
});

process.on("unhandledRejection", (razon) => {
  console.error("Promesa rechazada sin manejar:", razon);
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
