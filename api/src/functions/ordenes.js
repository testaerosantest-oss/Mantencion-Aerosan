
const { app } = require('@azure/functions');
const { getPool } = require('../database');

app.http('ordenes', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'ordenes',
  handler: async (request, context) => {
    try {
      const pool = await getPool();

      const result = await pool.request().query(`
        SELECT *
        FROM dbo.OrdenesTrabajo
        ORDER BY OrdenID DESC
      `);

      return {
        status: 200,
        jsonBody: result.recordset
      };
    } catch (error) {
      context.error('Error consultando órdenes:', error);

      return {
        status: 500,
        jsonBody: { error: 'No se pudieron consultar las órdenes.' }
      };
    }
  }
});
