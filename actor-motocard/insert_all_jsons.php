<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

require_once '../../vendor/autoload.php';
use Baseinn\DB_connect;

// ======================================================
// 1. CONFIGURACIÓN
// ======================================================
$client_id = "1234567890-abcdefghijklm.apps.googleusercontent.com"; // <-- Reemplaza con tu CLIENT_ID de IAP
$token_cache = "/tmp/id_token.txt";

// ======================================================
// 2. OBTENER O GENERAR TOKEN
// ======================================================
function obtenerIdToken($client_id, $token_cache) {
    // Si existe un token reciente (menos de 58 min) lo reutilizamos
    if (file_exists($token_cache) && (time() - filemtime($token_cache)) < 3500) {
        return trim(file_get_contents($token_cache));
    }

    // Generar un nuevo token con gcloud
    $command = escapeshellcmd("gcloud auth print-identity-token --audiences={$client_id}");
    $id_token = trim(shell_exec($command));

    if (!empty($id_token)) {
        file_put_contents($token_cache, $id_token);
        return $id_token;
    }

    return null;
}

$id_token = obtenerIdToken($client_id, $token_cache);

if (!$id_token) {
    echo json_encode([
        'success' => false,
        'message' => "❌ Error: No se pudo generar el ID token con gcloud."
    ]);
    exit;
}

// ======================================================
// 3. CONECTAR A LA BASE DE DATOS
// ======================================================
$conn = new DB_connect('MARIADB', 0);

// ======================================================
// 4. LEER EL JSON DEL BODY
// ======================================================
$input = file_get_contents('php://input');
$dataArray = json_decode($input, true);

if ($dataArray === null || !is_array($dataArray)) {
    echo json_encode([
        'success' => false,
        'message' => "❌ Error: El contenido recibido no es un JSON válido."
    ]);
    $conn->close();
    exit;
}

if (empty($dataArray)) {
    echo json_encode([
        'success' => false,
        'message' => "⚠️ No se recibieron datos para insertar."
    ]);
    $conn->close();
    exit;
}

// ======================================================
// 5. PREPARAR LA QUERY
// ======================================================
$sql = "
    INSERT INTO info_scrapping
    (ean, modelo, url, title, price, mainImage, allMainImages, description, `desc`, desc2)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
";
$stmt = $conn->execute_query($sql, "conexion");

if (!$stmt) {
    echo json_encode([
        'success' => false,
        'message' => "❌ ERROR: No se pudo preparar la query SQL."
    ]);
    $conn->close();
    exit;
}

// ======================================================
// 6. PROCESAR LOS REGISTROS
// ======================================================
$insertados = 0;
$errores = 0;
$detallesErrores = [];

foreach ($dataArray as $index => $data) {
    // Validar que sea un array con contenido
    if (!is_array($data)) {
        $errores++;
        $detallesErrores[] = "Registro en posición $index no es válido.";
        continue;
    }

    // Limpiar y convertir precio
    if (!empty($data['price'])) {
        $priceClean = str_replace(['€', ','], ['', '.'], $data['price']);
        $priceClean = trim($priceClean);
        $price = is_numeric($priceClean) ? $priceClean : null;
    } else {
        $price = null;
    }

    $result = $stmt->execute([
        $data['ean'] ?? null,
        $data['modelo'] ?? null,
        $data['url'] ?? null,
        $data['title'] ?? null,
        $price,
        $data['mainImage'] ?? null,
        json_encode($data['allMainImages'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        $data['description'] ?? null,
        $data['desc'] ?? null,
        $data['desc2'] ?? null
    ]);

    if ($result) {
        $insertados++;
    } else {
        $errores++;
        $detallesErrores[] = "Error al insertar registro en posición $index (EAN: {$data['ean']})";
    }
}

// ======================================================
// 7. RESPUESTA FINAL
// ======================================================
echo json_encode([
    'success' => $errores === 0,
    'message' => $errores === 0
        ? "✅ Todos los datos se insertaron correctamente."
        : "⚠️ Proceso finalizado con algunos errores.",
    'id_token_usado' => $id_token, // Solo mostrar en pruebas. BORRAR en producción
    'total_registros' => count($dataArray),
    'insertados' => $insertados,
    'errores' => $errores,
    'detalles_errores' => $detallesErrores
]);

$conn->close();
exit;
