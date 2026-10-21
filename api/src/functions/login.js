const { app } = require('@azure/functions');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { getPool, sql } = require('../database');

app.http('login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'login',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const username = String(body.username || '').trim();
      const password = String(body.password || '');

      if (!username || !password) {
        return {
          status: 400,
          jsonBody: { error: 'Ingresa tu usuario y contraseña.' }
        };
      }

      const pool = await getPool();
      const result = await pool.request()
        .input('username', sql.NVarChar(100), username)
        .query(`
          SELECT UsuarioId, NombreUsuario, NombreCompleto,
                 PasswordHash, Rol
          FROM dbo.Usuarios
          WHERE NombreUsuario = @username AND Activo = 1
        `);

      if (result.recordset.length === 0) {
        return {
          status: 401,
          jsonBody: { error: 'Usuario o contraseña incorrectos.' }
        };
      }

      const user = result.recordset[0];
      const validPassword = await bcrypt.compare(
        password,
        user.PasswordHash
      );

      if (!validPassword) {
        return {
          status: 401,
          jsonBody: { error: 'Usuario o contraseña incorrectos.' }
        };
      }

      const token = crypto.randomBytes(32).toString('hex');

      context.log(`Inicio de sesión correcto para UsuarioId ${user.UsuarioId}`);

      return {
        status: 200,
        jsonBody: {
          token,
          username: user.NombreUsuario,
          nombreCompleto: user.NombreCompleto,
          rol: user.Rol
        }
      };
    } catch (error) {
      context.error('Error en el inicio de sesión:', error.message);
      return {
        status: 500,
        jsonBody: {
          error: 'No se pudo iniciar sesión. Revisa la configuración de la API.'
        }
      };
    }
  }
});
