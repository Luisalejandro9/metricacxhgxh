# Guía de Configuración: Google Sheets y Apps Script

Para que tu dashboard pueda guardar datos en tu Google Sheet, necesitas configurar un pequeño script. Sigue estos pasos exactos:

## 1. Prepara tu Google Sheet
1. Crea una hoja de cálculo nueva en Google Sheets (o abre una existente).
2. Asegúrate de que la **Hoja 1** tenga los siguientes encabezados en la primera fila (Fila 1):
   - Columna A: `Fecha`
   - Columna B: `Hora Guardado`
   - Columna C: `Tiempo Total`
   - Columna D: `Casos Cerrados`
   - Columna E: `Casos Gestionados`
   - Columna F: `Efectividad`
   - Columna G: `Casos/Hora`
   - Columna H: `Prom. Cerrados`
   - Columna I: `Prom. Gestionados`
   - Columna J: `TMO Caso`
   - Columna K: `TMO Gestionado`

## 2. Crea el Script
1. En tu Google Sheet, ve al menú **Extensiones** > **Apps Script**.
2. Se abrirá una nueva pestaña. Borra todo el código que veas en el editor.
3. Copia y pega el siguiente código:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Parse data
  var data = JSON.parse(e.postData.contents);
  
  // Append row
  sheet.appendRow([
    data.fecha,
    data.horaGuardado,
    data.tiempoTotal,
    data.casosCerrados,
    data.casosGestionados,
    data.efectividad,
    data.casosPorHora,
    data.promedioCerrados,
    data.promedioGestionados,
    data.tmoCaso,
    data.tmoGestionado
  ]);
  
  return ContentService.createTextOutput("Success");
}
```

4. Haz clic en el icono de **Guardar** (disquete) y ponle un nombre al proyecto (ej: "Dashboard CxH").

## 3. Despliega el Script como Web App
1. Arriba a la derecha, haz clic en el botón azul **Implementar** (Deploy) > **Nueva implementación**.
2. En la ventana que aparece:
   - Haz clic en el icono de engranaje (⚙️) junto a "Seleccionar tipo" y elige **Aplicación web**.
   - En **Descripción**: pon algo como "v1".
   - En **Ejecutar como**: elige **Yo** (tu email).
   - En **Quién tiene acceso**: elige **Cualquier persona** (o "Anyone"). **IMPORTANTE**: Si no seleccionas "Cualquier persona", el dashboard no tendrá permiso para guardar los datos.
3. Haz clic en **Implementar**.
4. Te pedirá permisos. Acéptalos (es tu propio script).
   - *Nota*: Google te mostrará una advertencia de "Seguridad". Haz clic en *Avanzado* > *Ir a Dashboard CxH (inseguro)*. Esto es normal porque es un script personal no verificado por Google.

## 4. Obtén la URL
1. Una vez desplegado, verás una ventana con la "URL de la aplicación web".
2. **Copia esa URL** (empieza por `https://script.google.com/...`).

## 5. Conecta tu Dashboard
1. Vuelve a tu Dashboard (index.html).
2. Haz clic en el botón de configuración (⚙️) junto al botón verde de Guardar.
3. Pega la URL que acabas de copiar y guarda.

¡Listo! Ahora cada vez que hagas clic en "GUARDAR EN SHEETS", se añadirá una nueva fila a tu hoja de cálculo.
