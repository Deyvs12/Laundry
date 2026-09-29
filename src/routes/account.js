import { Hono } from 'hono'
import { index, changePassword } from '../controllers/account.js'

const accountRoutes = new Hono()

accountRoutes.get('/account', index)
accountRoutes.post('/account/password', changePassword)

export default accountRoutes
