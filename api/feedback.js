export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const { name = '', email = '', message = '' } = request.body ?? {}
  const cleanName = String(name).trim().slice(0, 120)
  const cleanEmail = String(email).trim().slice(0, 254)
  const cleanMessage = String(message).trim().slice(0, 5000)

  if (!cleanMessage) {
    return response.status(400).json({ error: 'Please enter your feedback.' })
  }

  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return response.status(400).json({ error: 'Please enter a valid email address.' })
  }

  if (!process.env.RESEND_API_KEY || !process.env.FEEDBACK_TO_EMAIL || !process.env.FEEDBACK_FROM_EMAIL) {
    return response.status(500).json({ error: 'Feedback email service is not configured.' })
  }

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Adrafteo Feedback <${process.env.FEEDBACK_FROM_EMAIL}>`,
      to: [process.env.FEEDBACK_TO_EMAIL],
      reply_to: cleanEmail || undefined,
      subject: `Adrafteo feedback from ${cleanName || 'a user'}`,
      text: `Name: ${cleanName || 'Not provided'}\nEmail: ${cleanEmail || 'Not provided'}\n\n${cleanMessage}`,
    }),
  })

  if (!resendResponse.ok) {
    return response.status(502).json({ error: 'The feedback email could not be sent.' })
  }

  return response.status(200).json({ message: 'Feedback sent successfully.' })
}
