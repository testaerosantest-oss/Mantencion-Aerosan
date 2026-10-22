
const { app } = require('@azure/functions');
const { sql, getPool } = require('../database');

app.http('equipos', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'equipos',
  handler: async (request, context) => {
    try {
      const pool = await getPool();

      if (request.method === 'GET') {
        const result = await pool.request().query(`
          SELECT EquipoID, Codigo, Nombre, Ubicacion,
                 Sector, Estado, FechaRegistro
          FROM dbo.Equipos
          ORDER BY EquipoID DESC
        `);

        return {
          status: 200,
          jsonBody: result.recordset
        };
      }

      const body = await request.json();
      const { Codigo, Nombre, Ubicacion, Sector, Estado } = body;

      if (
        typeof Codigo !== 'string' || !Codigo.trim() ||
        typeof Nombre !== 'string' || !Nombre.trim()
      ) {
        return {
          status: 400,
          jsonBody: {
            error: 'Codigo y Nombre son obligatorios.'
          }
        };
      }

      const result = await pool.request()
        .input('Codigo', sql.NVarChar, Codigo.trim())
        .input('Nombre', sql.NVarChar, Nombre.trim())
        .input('Ubicacion', sql.NVarChar, Ubicacion || null)
        .input('Sector', sql.NVarChar, Sector || null)
        .input('Estado', sql.NVarChar, Estado || 'Activo')
        .query(`
          INSERT INTO dbo.Equipos
            (Codigo, Nombre, Ubicacion, Sector, Estado)
          OUTPUT INSERTED.*
          VALUES
            (@Codigo, @Nombre, @Ubicacion, @Sector, @Estado)
        `);

      return {
        status: 201,
        jsonBody: result.recordset[0]
      };
    } catch (error) {
      context.error('Error en API equipos:', error);

      return {
        status: 500,
        jsonBody: { error: 'No se pudo procesar la solicitud de equipos.' }
      };
    }
  }
});
