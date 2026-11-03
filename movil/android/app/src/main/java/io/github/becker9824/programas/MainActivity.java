package io.github.becker9824.programas;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin propio: actualizar la app desde dentro (ActualizarPlugin)
        registerPlugin(ActualizarPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
