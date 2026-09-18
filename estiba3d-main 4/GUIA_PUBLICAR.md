# Estiba 3D — publicarlo con usuarios, gratis

Sigue esto en orden. Son tres cuentas (Supabase, Netlify, GitHub — el de GitHub ya lo tienes) y
unos 20-30 minutos. Al final tienes un link, y cada persona entra con su correo y contraseña.

---

## 1. Crear el proyecto en Supabase (10 min)

1. Ve a **supabase.com** → *Start your project* → crea tu cuenta (puedes usar tu cuenta de GitHub).
2. **New Project**. Ponle nombre (por ejemplo `estiba3d`), crea una contraseña de base de datos
   (guárdala, no la vas a necesitar de nuevo salvo emergencia) y elige la región más cercana.
3. Espera 1-2 minutos a que el proyecto quede listo (dice *Active*).
4. En el menú de la izquierda: **SQL Editor** → *New query*. Pega **todo** el contenido del
   archivo `supabase_setup.sql` que te dejo junto a esta guía, y presiona *Run*.
   Esto crea la tabla donde se guarda el proyecto de cada usuario, y la regla de que cada uno
   solo vea el suyo.
5. **Settings** (el engrane) → **API**. Ahí ves dos datos que vas a necesitar en el paso 3:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public key** (una clave larga que empieza con `eyJ...`)

   No son secretos: están hechas para ir en la página. Lo que protege los datos es la regla
   que acabas de crear con el SQL, no que esta clave esté oculta.

### Crear las cuentas de tus usuarios

**Authentication** (el ícono de personas) → **Users** → **Add user** → **Create new user**.
Pon el correo de la persona y una contraseña temporal (que la cambien después si quieres, o
avísales cuál es). Repite uno por uno. No hay registro abierto: solo entra quien tú agregues aquí.

---

## 2. Subir el proyecto a GitHub (5 min)

1. En GitHub, **New repository**. Nómbralo como quieras (por ejemplo `estiba3d`) y márcalo
   como **Private**.
2. Sube el contenido de la carpeta `estiba3d-main` que te entrego (todo el proyecto). Si nunca
   has hecho esto desde tu computadora, la forma más simple es arrastrar los archivos desde la
   página del repositorio en GitHub ("uploading an existing file") — no necesitas usar la
   terminal para este primer paso.

Con el repositorio **privado**, el código no lo ve nadie que tú no invites. Esto es distinto a
"GitHub Pages", que solo es gratis con repositorios públicos — por eso el siguiente paso usa
Netlify en vez de GitHub Pages.

---

## 3. Publicar con Netlify (5 min)

1. Ve a **netlify.com** → crea tu cuenta (puedes entrar con tu cuenta de GitHub, así quedan
   conectadas automáticamente).
2. **Add new site** → **Import an existing project** → **GitHub** → autoriza a Netlify a ver
   tus repositorios → elige el repositorio que subiste.
3. Netlify va a preguntar cómo construir el sitio. Pon:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Antes de darle *Deploy*, agrega dos variables de entorno (busca *Environment variables* /
   *Advanced settings* en esa misma pantalla, o después en *Site settings* → *Environment
   variables*):
   - `VITE_SUPABASE_URL` = tu Project URL del paso 1
   - `VITE_SUPABASE_ANON_KEY` = tu anon public key del paso 1
5. **Deploy site**. En 1-2 minutos te da un link (algo como `estiba3d-xyz.netlify.app`). Ese es
   el link que le mandas a la gente.

Cada vez que subas un cambio al repositorio de GitHub, Netlify vuelve a publicar solo.

---

## 4. La primera vez que alguien abre el link

La aplicación va a pedir, **una sola vez por navegador**, la Project URL y la anon key de
Supabase (los mismos dos datos del paso 1). Después de eso, pide correo y contraseña — los que
tú creaste en Authentication → Users.

Si prefieres que la gente no tenga que pegar esos dos datos la primera vez, dímelo: puedo
dejarlos ya puestos en el código antes de que lo subas a GitHub, usando las variables de entorno
del paso 3, y la pantalla de configuración desaparece por completo.

---

## Qué guarda y qué no

El botón **Guardar** sube a Supabase: el maestro de productos, el pedido, los vehículos, las
tarimas y las reglas — todo el proyecto tal como está en pantalla. El botón **Cargar** trae lo
último que guardaste. Cada persona solo ve lo que ella misma guardó, nunca lo de otro usuario.

Al entrar, si ya habías guardado algo antes, se carga solo.

---

## Si algo no prende

- **"Failed to fetch" al entrar:** la Project URL o la anon key están mal copiadas, o les falta
  un espacio de sobra. Revísalas en Settings → API.
- **"Correo o contraseña incorrectos":** verifica el correo exacto en Authentication → Users.
- **El sitio en Netlify no carga nada / pantalla blanca:** revisa en Netlify → tu sitio →
  *Deploys* que el último *deploy* diga "Published" y no "Failed". Si falló, el log de ahí dice
  por qué (casi siempre son las variables de entorno del paso 3, punto 4).
- **Después de una semana sin que nadie entre, el primer intento del día falla:** Supabase pausa
  los proyectos gratis tras 7 días sin uso. Entra un momento a tu panel de Supabase para
  reactivarlo, o dile a alguien que reintente a los 30 segundos.
