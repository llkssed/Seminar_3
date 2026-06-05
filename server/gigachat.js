import axios from 'axios'
import https from 'https'
import { randomUUID } from 'crypto'

let cachedToken = null
let tokenExpiresAt = 0

function getBasicAuth() {
  const clientId = process.env.GIGACHAT_CLIENT_ID
  const clientSecret = process.env.GIGACHAT_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Не заданы GIGACHAT_CLIENT_ID или GIGACHAT_CLIENT_SECRET')
  }

  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

async function getAccessToken() {
  const now = Date.now()

  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken
  }

  const response = await axios.post(
    'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
    new URLSearchParams({
      scope: 'GIGACHAT_API_PERS',
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'RqUID': randomUUID(),
        'Authorization': `Basic ${getBasicAuth()}`,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    }
  )

  const { access_token, expires_at } = response.data

  cachedToken = access_token
  tokenExpiresAt = Number(expires_at)

  return cachedToken
}

export async function askGigaChat(userMessage) {
  const token = await getAccessToken()

  const response = await axios.post(
    'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
    {
      model: 'GigaChat',
      messages: [
        {
          role: 'system',
          content: 'Ты полезный ассистент. Отвечай понятно и по делу.',
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
      stream: false,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    }
  )

  return response.data.choices?.[0]?.message?.content || 'Нет ответа от модели'
}