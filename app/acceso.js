// Programas · Entrar, crear cuenta, enlace al correo y esperar aprobación.
// Se carga en orden desde index.html (scripts normales: comparten variables y funciones).

// ---------- pantallas de acceso ----------
function screen(...kids) {
  buildNav([]);
  document.getElementById('app').replaceChildren(...[
    EMU ? h('div', { class: 'notice warn' }, 'Modo de prueba: usando el Firebase local de esta PC.') : null,
    h('div', { class: 'auth' }, ...kids)].filter(Boolean));
}
function loadingScreen() {
  buildNav([]);
  document.getElementById('app').replaceChildren(...[EMU ? h('div', { class: 'notice warn' }, 'Modo de prueba: usando el Firebase local de esta PC.') : null, skeletonHome()].filter(Boolean));
}
function screenMessage(msg) {
  screen(h('div', { class: 'card auth-card' }, h('p', null, msg),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => location.reload() }, 'Reintentar'), nube.user ? signOutBtn() : null)));
}

function renderAuth(tab = 'entrar', msg = '', withLink = false, em0 = '') {
  const linkMode = tab === 'entrar' && withLink;
  const field = (label, el) => h('label', { class: 'field' }, label, el);
  const email = h('input', { type: 'email', autocomplete: 'email', placeholder: 'tu@correo.com', value: em0 || linkEmail() || '' });
  const pass = h('input', { type: 'password', autocomplete: tab === 'entrar' ? 'current-password' : 'new-password',
    placeholder: tab === 'entrar' ? '' : 'Al menos 6 caracteres' });
  const code = h('input', { type: 'text', autocomplete: 'off', placeholder: 'Ej.: K7M3QX', style: { textTransform: 'uppercase' } });
  const name = h('input', { type: 'text', autocomplete: 'name', placeholder: 'Nombre y apellido' });
  const congI = h('input', { type: 'text', placeholder: 'Ej.: Congregación Centro' });
  const err = h('div', { class: 'err' }, msg);
  const boxes = consentBoxes();
  const btn = h('button', { class: 'btn primary', onclick: submit },
    linkMode ? '📧 Enviarme el enlace para entrar' : tab === 'entrar' ? 'Entrar' : tab === 'unirse' ? 'Crear mi cuenta' : 'Crear congregación');

  async function submit() {
    err.textContent = '';
    const em = email.value.trim(), pw = pass.value;
    if (tab !== 'entrar') {
      if (tab === 'unirse' && !code.value.trim()) return err.textContent = 'Escribe el código de la congregación.';
      if (tab === 'crear' && !squash(congI.value)) return err.textContent = 'Escribe el nombre de la congregación.';
      if (!squash(name.value)) return err.textContent = 'Escribe tu nombre.';
      if (!boxes.ok()) return err.textContent = 'Para crear la cuenta hay que marcar las tres casillas.';
    }
    btn.disabled = true;
    try {
      if (linkMode) {
        if (!em) throw { code: 'auth/missing-email' };
        await sendLoginLink(em);
        return renderLinkSent(em);
      }
      if (tab === 'entrar') await F.signInWithEmailAndPassword(F.auth, em, pw);
      else {
        nube.registro = tab === 'unirse' ? { tipo: 'unirse', codigo: code.value, nombre: name.value, acepta: true } : { tipo: 'crear', cong: congI.value, nombre: name.value, acepta: true };
        try { await F.createUserWithEmailAndPassword(F.auth, em, pw); }
        catch (e) {
          if (e.code !== 'auth/email-already-in-use') throw e;
          // El correo ya tiene cuenta (por ejemplo, su congregación se borró): se entra con ella y se sigue
          try { await F.signInWithEmailAndPassword(F.auth, em, pw); } catch (e2) { throw { code: 'cuenta-existe' }; }
        }
      }
    } catch (e) { nube.registro = null; err.textContent = errMsg(e); btn.disabled = false; }
  }
  async function forgot() {
    const em = email.value.trim();
    if (!em) return err.textContent = 'Escribe tu correo y vuelve a pulsar “¿Olvidaste tu contraseña?”.';
    try { await F.sendPasswordResetEmail(F.auth, em); toast('Te enviamos un correo para cambiar tu contraseña.'); }
    catch (e) { err.textContent = errMsg(e); }
  }

  const card = h('div', { class: 'card auth-card' },
    h('div', { class: 'tabs' }, [['entrar', 'Entrar'], ['unirse', 'Crear cuenta'], ['crear', 'Nueva congregación']].map(([k, t]) =>
      h('button', { class: k === tab ? 'on' : null, onclick: () => renderAuth(k) }, t))),
    linkMode ? h('p', { class: 'muted small-text' }, 'Te mandamos un correo con un botón: al tocarlo, entras sin escribir tu contraseña.') : null,
    tab === 'unirse' ? h('p', { class: 'muted small-text' }, 'Pide el código a un administrador de tu congregación. Tu cuenta quedará en espera hasta que te aprueben.') : null,
    tab === 'crear' ? h('p', { class: 'muted small-text' }, 'Solo para el primer administrador. Después compartirás el código para que los demás creen su cuenta.') : null,
    tab === 'unirse' ? field('Código de la congregación', code) : null,
    tab === 'crear' ? field('Nombre de la congregación', congI) : null,
    tab !== 'entrar' ? field('Tu nombre', name) : null,
    field('Correo', email), linkMode ? null : field('Contraseña', h('span', { class: 'pass-wrap' }, pass,
      h('button', { type: 'button', class: 'pass-eye', title: 'Mostrar u ocultar la contraseña', 'aria-label': 'Mostrar u ocultar la contraseña', onclick: e => {
        e.preventDefault();
        const b = e.currentTarget, show = pass.type === 'password';
        pass.type = show ? 'text' : 'password';
        b.replaceChildren(icon(show ? 'eyeoff' : 'eye', 18));
      } }, icon('eye', 18)))),
    tab !== 'entrar' ? boxes.el : null,
    err, btn,
    legalLinks(),
    tab === 'entrar' ? h('button', { class: 'linkbtn', onclick: () => renderAuth('entrar', '', !withLink, email.value.trim()) },
      withLink ? '🔑 Entrar con mi contraseña' : '📧 Entrar sin contraseña (te mando un enlace)') : null,
    tab === 'entrar' ? h('button', { class: 'linkbtn', onclick: forgot }, '¿Olvidaste tu contraseña?') : null);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') submit(); });
  screen(h('div', { class: 'auth-hero' }, logo(64), h('h2', null, 'Programas'),
    h('p', null, 'La reunión, las asignaciones y la congregación, en un solo lugar.')), card);
}

// ---------- entrar con un enlace al correo ----------
// La contraseña queda de respaldo. Plan gratis de Firebase: 5 correos de enlace al día para todo el proyecto
// (por eso se ofrece siempre la contraseña). La app de PC (app://) y el APK no reciben el enlace directo:
// el correo lo abre en la web, que lo pasa a la app con programas://entrar?l=… o se copia y se pega.
const LINK_APP = location.protocol === 'app:' || NATIVE;
const linkEmail = () => { try { return localStorage.getItem('correo-enlace') || ''; } catch (e) { return ''; } };
function linkReturnUrl() {
  const web = EMU ? 'http://localhost:8765/?emu' : LINK_APP ? WEB_URL : location.origin + location.pathname;
  return LINK_APP ? web + (web.includes('?') ? '&' : '?') + 'para-app=1' : web;
}
async function sendLoginLink(em) {
  await F.sendSignInLinkToEmail(F.auth, em, { url: linkReturnUrl(), handleCodeInApp: true });
  try { localStorage.setItem('correo-enlace', em); } catch (e) {}
}
async function completeLink(href, em) {
  await F.signInWithEmailLink(F.auth, em, href);
  try { localStorage.removeItem('correo-enlace'); } catch (e) {}
}
// Enlace pegado o recibido (programas://entrar?l=… o el del correo tal cual)
function receiveLink(url) {
  let href = String(url || '').trim();
  try { const u = new URL(href); if (u.protocol === 'programas:') href = u.searchParams.get('l') || ''; } catch (e) {}
  if (!F) { nube.enlace = href; return true; }
  if (!F.isSignInWithEmailLink(F.auth, href)) return false;
  if (!linkEmail()) renderLinkEmail(href);
  else completeLink(href, linkEmail()).then(watchAuth, e => { toast(errMsg(e)); watchAuth(); });
  return true;
}
function renderLinkSent(em) {
  const paste = h('input', { type: 'text', autocomplete: 'off', placeholder: 'Pega aquí el enlace' });
  const err = h('div', { class: 'err' });
  const resend = h('button', { class: 'btn', onclick: async () => {
    resend.disabled = true;
    try { await sendLoginLink(em); toast('Te mandamos otro enlace.'); } catch (e) { err.textContent = errMsg(e); }
    resend.disabled = false;
  } }, 'Mandar otro');
  screen(h('div', { class: 'card auth-card' },
    h('h2', null, '📧 Revisa tu correo'),
    h('p', null, 'Te mandamos un enlace a ', h('b', null, em), '. Abre el correo y pulsa el botón para entrar.'),
    h('p', { class: 'muted small-text' }, 'Puede tardar un minuto. Si no aparece, revisa la carpeta de Spam o Correo no deseado.'),
    LINK_APP ? [
      h('p', { class: 'muted small-text' }, 'Si abres el correo en esta misma computadora, el navegador te ofrece volver a Programas.'),
      h('details', { class: 'link-paste' }, h('summary', null, '¿No se abrió Programas? Pegar el enlace'),
      h('p', { class: 'muted small-text' }, 'Copia el enlace (en el correo, mantén pulsado o clic derecho sobre el botón → Copiar enlace) y pégalo aquí:'),
      h('label', { class: 'field' }, 'Enlace del correo', paste),
      h('button', { class: 'btn primary', onclick: () => { err.textContent = receiveLink(paste.value) ? '' : errMsg({ code: 'enlace-malo' }); } }, 'Entrar'))] : null,
    err,
    h('div', { class: 'row' }, resend, h('button', { class: 'btn', onclick: () => renderAuth('entrar', '', false, em) }, '🔑 Usar mi contraseña'),
      h('button', { class: 'linkbtn', onclick: () => renderAuth() }, 'Volver'))));
}
// Se abrió el enlace en otro equipo o navegador: se confirma el correo
function renderLinkEmail(href) {
  const email = h('input', { type: 'email', autocomplete: 'email', placeholder: 'tu@correo.com' });
  const err = h('div', { class: 'err' });
  const btn = h('button', { class: 'btn primary', onclick: async () => {
    btn.disabled = true; err.textContent = '';
    try { await completeLink(href, email.value.trim()); watchAuth(); }
    catch (e) { err.textContent = e.code === 'auth/invalid-email' ? 'Ese no es el correo al que llegó el enlace.' : errMsg(e); btn.disabled = false; }
  } }, 'Entrar');
  email.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
  screen(h('div', { class: 'card auth-card' },
    h('h2', null, 'Confirma tu correo'),
    h('p', { class: 'muted' }, 'Para terminar de entrar, escribe el correo al que te llegó el enlace.'),
    h('label', { class: 'field' }, 'Correo', email), err,
    h('div', { class: 'row' }, btn, h('button', { class: 'linkbtn', onclick: watchAuth }, 'Cancelar'))));
}
// Página web abierta desde un enlace que se pidió en la app de PC o en el APK
function renderLinkForApp(href) {
  const copy = () => navigator.clipboard.writeText(href).then(() => toast('Enlace copiado. Vuelve a Programas y pégalo.'), () => toast('No se pudo copiar'));
  screen(h('div', { class: 'card auth-card' },
    h('h2', null, '📧 Enlace para entrar'),
    h('p', null, 'Pediste este enlace desde la app de Programas (en la PC o en el celular).'),
    h('div', { class: 'row' }, h('a', { class: 'btn primary', style: { textDecoration: 'none' }, href: 'programas://entrar?l=' + encodeURIComponent(href) }, 'Abrir en Programas'),
      h('button', { class: 'btn', onclick: copy }, 'Copiar enlace')),
    h('p', { class: 'muted small-text' }, 'Si no se abre, pulsa “Copiar enlace”, vuelve a la app y pégalo donde dice “Pega aquí el enlace”.'),
    h('button', { class: 'linkbtn', onclick: () => linkEmail() ? completeLink(href, linkEmail()).then(watchAuth, e => { toast(errMsg(e)); watchAuth(); }) : renderLinkEmail(href) },
      'Mejor entrar aquí, en el navegador')));
}

// Con sesión iniciada pero sin congregación (o la quitaron)
function renderJoin(msg = '') {
  const code = h('input', { type: 'text', autocomplete: 'off', placeholder: 'Ej.: K7M3QX', style: { textTransform: 'uppercase' } });
  const name = h('input', { type: 'text', autocomplete: 'name', placeholder: 'Nombre y apellido' });
  const err = h('div', { class: 'err' }, msg);
  const btn = h('button', { class: 'btn primary', onclick: async () => {
    if (!squash(name.value)) return err.textContent = 'Escribe tu nombre.';
    btn.disabled = true; err.textContent = '';
    try { await joinCongregation(code.value, name.value); location.reload(); }
    catch (e) { err.textContent = errMsg(e); btn.disabled = false; }
  } }, 'Unirme');
  screen(h('div', { class: 'card auth-card' },
    h('h2', null, 'Unirte a una congregación'),
    h('p', { class: 'muted' }, `Entraste como ${nube.user.email}. Escribe el código que te dio un administrador.`),
    h('label', { class: 'field' }, 'Código de la congregación', code),
    h('label', { class: 'field' }, 'Tu nombre', name),
    err, h('div', { class: 'row' }, btn, signOutBtn())));
}

function renderWaiting() {
  screen(h('div', { class: 'card auth-card' },
    h('h2', null, '⏳ Esperando aprobación'),
    h('p', null, `Hola, ${nube.me.nombre}. Tu cuenta ya está creada y un administrador de la congregación tiene que aprobarla.`),
    h('p', { class: 'muted' }, 'Esta pantalla cambiará sola en cuanto te aprueben. Puedes cerrar la app y volver más tarde.'),
    h('div', { class: 'row' }, signOutBtn())));
}
