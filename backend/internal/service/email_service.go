package service

import (
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strings"
)

// =============================================================
// Servicio de correo electrónico para notificaciones
// =============================================================

// EmailConfig contiene la configuración SMTP desde variables de entorno.
type EmailConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	From     string
}

// LoadEmailConfig carga la configuración SMTP desde variables de entorno.
func LoadEmailConfig() *EmailConfig {
	return &EmailConfig{
		Host:     os.Getenv("SMTP_HOST"),
		Port:     os.Getenv("SMTP_PORT"),
		User:     os.Getenv("SMTP_USER"),
		Password: os.Getenv("SMTP_PASS"),
		From:     os.Getenv("SMTP_FROM"),
	}
}

// IsConfigured verifica si el servicio de correo está configurado.
func (c *EmailConfig) IsConfigured() bool {
	return c.Host != "" && c.Port != "" && c.User != "" && c.Password != ""
}

// SendEmail envía un correo electrónico usando SMTP.
func (c *EmailConfig) SendEmail(to, subject, body string) error {
	if !c.IsConfigured() {
		log.Printf("⚠️ EMAIL: SMTP no configurado. No se envió correo a %s", to)
		return nil
	}

	from := c.From
	if from == "" {
		from = c.User
	}

	// Construir headers y cuerpo del mensaje
	headers := make(map[string]string)
	headers["From"] = from
	headers["To"] = to
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=\"UTF-8\""

	var msgParts []string
	for k, v := range headers {
		msgParts = append(msgParts, fmt.Sprintf("%s: %s", k, v))
	}
	msgParts = append(msgParts, "", body)
	msg := strings.Join(msgParts, "\r\n")

	addr := fmt.Sprintf("%s:%s", c.Host, c.Port)
	auth := smtp.PlainAuth("", c.User, c.Password, c.Host)

	err := smtp.SendMail(addr, auth, from, []string{to}, []byte(msg))
	if err != nil {
		return fmt.Errorf("error al enviar correo a %s: %w", to, err)
	}

	log.Printf("✅ EMAIL: Correo enviado exitosamente a %s (Asunto: %s)", to, subject)
	return nil
}

// SendCotizacionEnviada notifica al cliente que tiene una cotización disponible.
func (c *EmailConfig) SendCotizacionEnviada(clienteEmail, clienteNombre, descripcionObra string, cotizacionID int) error {
	if clienteEmail == "" {
		log.Printf("⚠️ EMAIL: No se envió correo - cliente sin email para cotización #%d", cotizacionID)
		return nil
	}

	subject := fmt.Sprintf("Nueva Cotización #%d - mediVidrios", cotizacionID)
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;padding:20px;background:#f5f5f5;">
<div style="max-width:600px;margin:auto;background:white;border-radius:8px;padding:30px;">
<div style="text-align:center;margin-bottom:20px;">
<div style="width:60px;height:60px;background:#1e40af;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;">
<span style="color:white;font-size:24px;font-weight:bold;">M</span>
</div>
</div>
<h2 style="color:#1e293b;text-align:center;">¡Nueva Cotización Disponible!</h2>
<p style="color:#475569;font-size:15px;line-height:1.5;">Estimado/a <strong>%s</strong>,</p>
<p style="color:#475569;font-size:15px;line-height:1.5;">Se ha generado una nueva cotización para su proyecto: <strong>%s</strong>.</p>
<table style="width:100%%;border-collapse:collapse;margin:20px 0;background:#f8fafc;border-radius:6px;">
<tr><td style="padding:12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;">Número de Cotización</td>
<td style="padding:12px;border-bottom:1px solid #e2e8f0;font-weight:bold;font-size:14px;">#%d</td></tr>
<tr><td style="padding:12px;color:#64748b;font-size:14px;">Estado</td>
<td style="padding:12px;font-weight:bold;color:#2563eb;font-size:14px;">Enviada</td></tr>
</table>
<p style="color:#475569;font-size:15px;line-height:1.5;">Puede revisar los detalles completos y descargar el PDF ingresando a la plataforma con su cuenta de usuario.</p>
<div style="text-align:center;margin:30px 0;">
<a href="https://medividriospro.onrender.com" style="background:#1e40af;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold;">Ir a la Plataforma</a>
</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
<p style="color:#94a3b8;font-size:12px;text-align:center;">mediVidrios - Rubiel Antonio Ruidiaz Comas<br>CALLE 20 #28-21 DUITAMA<br>rubanruic@gmail.com</p>
</div>
</body>
</html>`, clienteNombre, descripcionObra, cotizacionID)

	return c.SendEmail(clienteEmail, subject, body)
}
