import { Hono } from 'hono'
import { showLogin, login, logout } from '../controllers/auth.js'

const auth = new Hono()

auth.get('/login', showLogin)
auth.post('/auth/login', login)
auth.post('/auth/logout', logout)

export default auth
