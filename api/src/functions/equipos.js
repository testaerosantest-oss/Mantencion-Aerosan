```javascript
const { app } = require('@azure/functions');
const { sql, getPool } = require('../database');

app.http('equipos', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'equipos',

  handler: async (request, context) => {
    try {
      context.log('Iniciando solicitud de API equipos');
      const pool = await getPool();

      // CONSULTAR EQUIPOS
      if (request.method === 'GET') {
        context.log('Consultando tabla dbo.Equipos');

        const result = await pool.request().query(`
          SELECT
            EquipoID,
            Codigo,
            Nombre,
            Ubicacion,
            Sector,
            Estado,
            FechaRegistro
          FROM dbo.Equipos
          ORDER BY EquipoID DESC;
        `);

        context.log(
          `Consulta completada. Equipos encontrados: ${result.recordset.length}`
        );

        return {
          status: 200,
          jsonBody: result.recordset
        };
      }

      // REGISTRAR EQUIPO NUEVO
      if (request.method === 'POST') {
        context.log('Registrando equipo nuevo');

        const body = await request.json();

        const {
          Codigo,
          Nombre,
          Ubicacion,
          Sector,
          Estado
        } = body;

        if (
          typeof Codigo !== 'string' ||
          !Codigo.trim() ||
          typeof Nombre !== 'string' ||
          !Nombre.trim()
        ) {
          return {
            status: 400,
            jsonBody: {
              error: 'Los campos Codigo y Nombre son obligatorios.'
            }
          };
        }

        const result = await pool.request()
          .input('Codigo', sql.NVarChar, Codigo.trim())
          .input('Nombre', sql.NVarChar, Nombre.trim())
          .input(
            'Ubicacion',
            sql.NVarChar,
            Ubicacion ? String(Ubicacion).trim() : null
          )
          .input(
            'Sector',
            sql.NVarChar,
            Sector ? String(Sector).trim() : null
          )
          .input(
            'Estado',
            sql.NVarChar,
            Estado ? String(Estado).trim() : 'Activo'
          )
          .query(`
            INSERT INTO dbo.Equipos
              (Codigo, Nombre, Ubicacion, Sector, Estado)
            OUTPUT
              INSERTED.EquipoID,
              INSERTED.Codigo,
              INSERTED.Nombre,
              INSERTED.Ubicacion,
              INSERTED.Sector,
              INSERTED.Estado,
              INSERTED.FechaRegistro
            VALUES
              (@Codigo, @Nombre, @Ubicacion, @Sector, @Estado);
          `);

        context.log(
          `Equipo registrado. ID: ${result.recordset[0].EquipoID}`
        );

        return {
          status: 201,
          jsonBody: result.recordset[0]
        };
      }

      return {
        status: 405,
        jsonBody: {
          error: 'Método HTTP no permitido.'
        }
      };

    } catch (error) {
      // DETALLE TEMPORAL PARA DIAGNÓSTICO
      context.error('Error en API equipos:', {
        message: error.message,
        code: error.code,
        number: error.number,
        state: error.state,
        stack: error.stack
      });

      return {
        status: 500,
        jsonBody: {
          error: 'No se pudo procesar la solicitud de equipos.',
          detalle: error.message,
          codigo: error.code || null
        }
      };
    }
  }
});
```
