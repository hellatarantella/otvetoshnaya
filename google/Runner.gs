/**
 * «Ответошная» — постоянная связь программы с отчётами «Позитив», «Негатив» и справочником.
 *
 * Этот скрипт ставится ОДИН РАЗ и больше никогда не обновляется: всю работу с отчётами
 * программа присылает сама при каждом обращении, поэтому новые версии программы
 * сразу работают по новым правилам без правок здесь.
 *
 * Скрипт работает от вашего имени и правит только файлы отчётов. Программа связывается с ним
 * по секретному ключу, который знает только она (первое подключение запоминает ключ).
 */
var RUNNER = 1;

function doGet() { return out_({ ok: true, app: 'Ответошная', runner: RUNNER }); }

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(120000);
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var props = PropertiesService.getScriptProperties();
    var tok = props.getProperty('TOKEN');
    var given = String(req.token || '');
    if (given.length < 32) return out_({ ok: false, error: 'Нет ключа программы', runner: RUNNER });
    if (req.action === 'pair') {
      if (tok && tok !== given) return out_({ ok: false, error: 'Скрипт уже связан с другой копией программы. Создайте новое развертывание.', runner: RUNNER });
      if (!tok) props.setProperty('TOKEN', given);
    } else if (!tok || tok !== given) return out_({ ok: false, error: 'Нет доступа: подключите скрипт заново', runner: RUNNER });
    if (!req.code) return out_({ ok: false, error: 'Обновите программу «Ответошная»', runner: RUNNER });
    // логика отчётов — из программы (проверена ключом выше)
    var lib = (new Function(String(req.code) + '\nreturn { ACTIONS: ACTIONS, VERSION: VERSION, state: state };'))();
    if (req.action === 'pair') return out_({ ok: true, version: lib.VERSION, runner: RUNNER, state: lib.state() });
    var fn = lib.ACTIONS[req.action];
    if (!fn) return out_({ ok: false, error: 'Неизвестное действие: ' + req.action, runner: RUNNER });
    var res = fn(req) || {};
    res.ok = true; res.version = lib.VERSION; res.runner = RUNNER;
    return out_(res);
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err), runner: RUNNER });
  } finally {
    lock.releaseLock();
  }
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* Разрешения, которые нужны логике отчётов (Google спрашивает их один раз при установке).
   Функция не вызывается: она только перечисляет службы. */
function permissions_() {
  SpreadsheetApp.openById('x'); DocumentApp.openById('x'); DriveApp.getFileById('x');
  UrlFetchApp.fetch('https://www.googleapis.com/'); ScriptApp.getOAuthToken(); Utilities.base64Encode('');
}

/* Для проверки из редактора: Выполнить → testRunner */
function testRunner() { Logger.log('Ответошная: скрипт на месте, версия связи ' + RUNNER); }
