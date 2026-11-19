import { Hono } from 'hono'
import { index, test } from '../controllers/printer.js'

const printerRoutes = new Hono()

printerRoutes.get('/printer', index)
printerRoutes.post('/printer/test', test)

export default printerRoutes
