import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { askGigaChat } from './gigachat.js'
import axios from 'axios'

const ECO_API_URL = process.env.ECO_API_URL || 'http://localhost:3000/api'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use(express.static(path.join(__dirname, '../public')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

async function buildContext(message, userId) {
  const parts = []

  try {
    const [{ data: wasteTypes }, { data: points }] = await Promise.all([
      axios.get(`${ECO_API_URL}/waste-types`),
      axios.get(`${ECO_API_URL}/collection-points`),
    ])

    parts.push(
      `Типы отходов в системе: ${wasteTypes.map(w => `${w.name} (${w.unit}, CO2/ед: ${w.co2_per_unit})`).join('; ')}.`
    )
    parts.push(
      `Пункты приёма: ${points.map(p => `${p.name} — ${p.address}`).join('; ')}.`
    )
  } catch (e) {
    console.warn('Не удалось получить справочники:', e.message)
  }

  if (userId) {
    try {
      const { data: impact } = await axios.get(`${ECO_API_URL}/users/${userId}/eco-impact`)
      parts.push(
        `Статистика пользователя: отчётов — ${impact.totals.total_reports}, ` +
        `всего сдано — ${impact.totals.total_amount}, CO2 сэкономлено — ${impact.totals.co2_saved}.`
      )

      const { data: achievements } = await axios.get(`${ECO_API_URL}/users/${userId}/achievements`)
      if (achievements.length) {
        parts.push(`Достижения пользователя: ${achievements.map(a => a.title).join(', ')}.`)
      }
    } catch (e) {
      console.warn('Не удалось получить данные пользователя:', e.message)
    }
  }

  if (/отчет|report|сдал|история/i.test(message)) {
    try {
      const { data: reports } = await axios.get(`${ECO_API_URL}/recycling-reports`)
      const recent = reports.slice(0, 5)
        .map(r => `${r.user_name}: ${r.amount} ${r.waste_type_name} в ${r.collection_point_name}`)
        .join('; ')
      parts.push(`Последние отчёты: ${recent}.`)
    } catch (e) {
      console.warn('Не удалось получить отчёты:', e.message)
    }
  }

  return parts.join(' ')
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId } = req.body
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Сообщение пустое' })
    }

    const context = await buildContext(message, userId)
    const reply = await askGigaChat(message, context)
    res.json({ reply })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message || 'Ошибка сервера' })
  }
})

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`)
})
