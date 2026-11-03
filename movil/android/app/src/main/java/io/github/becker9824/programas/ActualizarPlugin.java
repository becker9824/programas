package io.github.becker9824.programas;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

// Actualizar la app sin pasar por el navegador: baja el APK nuevo dentro de la app
// (con su avance) y abre el instalador de Android, que lo pone encima de la versión actual.
@CapacitorPlugin(name = "Actualizar")
public class ActualizarPlugin extends Plugin {

    // Android 8 o más pide permiso para instalar apps desde esta app (una sola vez)
    @PluginMethod
    public void puedeInstalar(PluginCall call) {
        JSObject r = new JSObject();
        r.put("valor", Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls());
        call.resolve(r);
    }

    @PluginMethod
    public void pedirPermiso(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 26) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    // Avisa el avance con el evento "progreso" { p: 0-100 }
    @PluginMethod
    public void descargarEInstalar(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("Dirección no válida");
            return;
        }
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                File dir = new File(getContext().getCacheDir(), "actualizacion");
                dir.mkdirs();
                File apk = new File(dir, "Programas.apk");
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setInstanceFollowRedirects(true); // GitHub manda a otra dirección para el archivo
                c.setConnectTimeout(20000);
                c.setReadTimeout(30000);
                if (c.getResponseCode() != 200) throw new Exception("el servidor respondió " + c.getResponseCode());
                long total = c.getContentLengthLong(), done = 0;
                int last = -1;
                try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[65536];
                    for (int n; (n = in.read(buf)) > 0; ) {
                        out.write(buf, 0, n);
                        done += n;
                        int p = total > 0 ? (int) (done * 100 / total) : -1;
                        if (p != last) {
                            last = p;
                            JSObject ev = new JSObject();
                            ev.put("p", p);
                            notifyListeners("progreso", ev);
                        }
                    }
                }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                call.resolve();
            } catch (Exception e) {
                call.reject("No se pudo descargar: " + e.getMessage());
            } finally {
                if (c != null) c.disconnect();
            }
        }).start();
    }
}
