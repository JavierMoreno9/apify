<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

require_once '../../vendor/autoload.php'; // no cambiar****
use Baseinn\DB_connect; // no cambiar****

// ===== Crear conexión =====
$conn = new DB_connect('MARIADB', 0);

// ===== Recibir datos desde Node.js =====
$input = file_get_contents('php://input');
$dataArray = json_decode($input, true);

// ===== Validar que el JSON sea correcto =====
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

$insertados = 0;
$errores = 0;
$detallesErrores = [];

// ===== Preparar sentencia SQL segura =====
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

// ===== Recorrer los registros enviados desde Node.js =====
foreach ($dataArray as $index => $data) {
    // Validar que sea un array con contenido
    if (!is_array($data)) {
        $errores++;
        $detallesErrores[] = "Registro en posición $index no es válido.";
        continue;
    }

    // ===== Limpiar precio (quita € y comas) =====
    if (!empty($data['price'])) {
        $priceClean = str_replace(['€', ','], ['', '.'], $data['price']);
        $priceClean = trim($priceClean);
        $price = is_numeric($priceClean) ? $priceClean : null;
    } else {
        $price = null;
    }

    // ===== Ejecutar el insert =====
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

// ===== Respuesta final =====
echo json_encode([
    'success' => $errores === 0,
    'message' => $errores === 0
        ? "✅ Todos los datos se insertaron correctamente."
        : "⚠️ Proceso finalizado con algunos errores.",
    'total_registros' => count($dataArray),
    'insertados' => $insertados,
    'errores' => $errores,
    'detalles_errores' => $detallesErrores
]);

$conn->close();
exit;
