
/*
  SERVER.JS

  Este archivo es el servidor de nuestra página web.
  Se encarga de:
  - Recibir las solicitudes del navegador.
  - Validar los datos del formulario.
  - Limitar el número de solicitudes.
  - Enviar correos electrónicos mediante SMTP.
*/

// Carga las variables privadas del archivo .env.
require("dotenv").config();

// Importamos Express para crear el servidor web.
const express = require("express");

// Importamos Nodemailer para enviar correos electrónicos.
const nodemailer = require("nodemailer");

// Importamos express-rate-limit para limitar las solicitudes.
const rateLimit = require("express-rate-limit");

// Importamos path para gestionar rutas de archivos.
const path = require("path");

// Creamos la aplicación de Express.
const app = express();

// Evita mostrar una cabecera que identifica Express.
app.disable("x-powered-by");

// Permite recibir datos JSON enviados desde el navegador.
// El límite evita aceptar solicitudes con cuerpos excesivamente grandes.
app.use(express.json({ limit: "10kb" }));

// Limita las solicitudes al endpoint de envío.
// En este ejemplo, cada IP puede realizar 5 solicitudes por hora.
// El límite se guarda en memoria y se reinicia al reiniciar el servidor.
app.use(
  "/api/enviar",
  rateLimit({
    windowMs: 60 * 60 * 1000, // Una hora en milisegundos.
    max: 5,                   // Máximo de solicitudes durante esa hora.
    standardHeaders: true,    // Devuelve cabeceras con información del límite.
    legacyHeaders: false,     // Desactiva las cabeceras antiguas.
    message: {
      error: "Has alcanzado el límite. Inténtalo más tarde."
    }
  })
);

// Configuramos Nodemailer con los datos del archivo .env.
// Las credenciales nunca se envían al navegador.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),

  // true suele utilizarse con el puerto 465.
  // false permite negociar STARTTLS, habitualmente en el 587.
  secure: process.env.SMTP_SECURE === "true",

  // Usuario y contraseña de la cuenta SMTP.
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Publicamos los archivos de la carpeta "public".
// Así el navegador podrá cargar index.html.
app.use(express.static(path.join(__dirname, "public")));

// Creamos la ruta que recibe los datos del formulario.
app.post("/api/enviar", async (req, res) => {
  // Extraemos los campos que envía la página web.
  const { correo, mensaje, consentimiento } = req.body || {};

  // Comprobamos que se haya marcado la casilla de consentimiento.
  if (consentimiento !== true) {
    return res.status(400).json({
      error: "Debes confirmar que el destinatario acepta recibir el correo."
    });
  }

  // Validamos el formato básico de la dirección.
  // Esta comprobación no garantiza que el buzón exista.
  if (
    typeof correo !== "string" ||
    correo.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
  ) {
    return res.status(400).json({
      error: "La dirección de correo no es válida."
    });
  }

  // Comprobamos que el mensaje sea texto y no exceda 3000 caracteres.
  if (
    typeof mensaje !== "string" ||
    mensaje.trim().length < 1 ||
    mensaje.length > 3000
  ) {
    return res.status(400).json({
      error: "El mensaje debe tener entre 1 y 3000 caracteres."
    });
  }

  try {
    // Enviamos un único correo al destinatario indicado.
    await transporter.sendMail({
      // Nombre visible del remitente y cuenta SMTP autenticada.
      from: `"${process.env.MAIL_FROM_NAME || "Correo web"}" <${process.env.SMTP_USER}>`,

      // Dirección de destino.
      to: correo,

      // Asunto fijo para esta versión de prueba.
      subject: "Mensaje de prueba",

      // Contenido en texto plano.
      text: mensaje
    });

    // Respondemos al navegador si el envío se completa.
    res.json({
      ok: true,
      mensaje: "Correo enviado correctamente."
    });

  } catch (error) {
    // Registramos un mensaje genérico sin mostrar credenciales.
    // No enviamos el error interno al navegador.
    console.error("Error al enviar el correo.");

    // Informamos al navegador de que el envío ha fallado.
    res.status(500).json({
      error: "No se pudo enviar el correo. Comprueba la configuración."
    });
  }
});

// Elegimos el puerto del servidor.
// Si PORT no está definido en .env, utilizamos el 3000.
const port = Number(process.env.PORT || 3000);

// Iniciamos el servidor y mostramos la dirección local.
app.listen(port, () => {
  console.log(`Servidor disponible en http://localhost:${port}`);
});
