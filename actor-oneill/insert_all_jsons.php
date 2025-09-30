<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

require_once '../../vendor/autoload.php';

use Baseinn\DB_connect;

// ===== Definir HTTP_HOST si no existe (CLI) =====
if (!isset($_SERVER['HTTP_HOST'])) {
    $_SERVER['HTTP_HOST'] = 'localhost';
}

// ===== Carpeta donde están los JSON =====
$jsonDirectory = __DIR__ . "/output";

// ===== Verificar carpeta output =====
if (!is_dir($jsonDirectory)) {
    echo json_encode([
        'success' => false,
        'message' => "❌ ERROR: La carpeta '$jsonDirectory' no existe."
    ]);
    exit;
}

$conn = new DB_connect('MARIADB', 0);

// ===== Buscar todos los archivos JSON =====
$files = glob($jsonDirectory . "/*.json");

if (empty($files)) {
    echo json_encode([
        'success' => false,
        'message' => "⚠️ No se encontraron archivos JSON en la carpeta $jsonDirectory"
    ]);
    $conn->close();
    exit;
}

$insertados = 0;
$errores = 0;
$detallesErrores = [];

foreach ($files as $filePath) {
    $fileName = basename($filePath);
    $jsonContent = file_get_contents($filePath);
    $data = json_decode($jsonContent, true);

    if ($data === null) {
        $errores++;
        $detallesErrores[] = "Archivo $fileName con JSON mal formado.";
        continue;
    }

    // ===== Limpiar y preparar datos =====
    $ean           = addslashes($data['ean'] ?? '');
    $modelo        = addslashes($data['modelo'] ?? '');
    $url           = addslashes($data['url'] ?? '');
    $title         = addslashes($data['title'] ?? '');
    $mainImage     = addslashes($data['mainImage'] ?? '');
    $description   = addslashes($data['description'] ?? '');
    $desc          = addslashes($data['desc'] ?? '');
    $desc2         = addslashes($data['desc2'] ?? '');
    $allMainImages = addslashes(json_encode($data['allMainImages'] ?? []));

    // ===== Limpiar precio (quita € y comas) =====
    if (!empty($data['price'])) {
        $priceClean = str_replace(['€', ','], ['', '.'], $data['price']);
        $priceClean = trim($priceClean);
        $price = is_numeric($priceClean) ? $priceClean : 'NULL';
    } else {
        $price = 'NULL';
    }

    // ===== Query de inserción =====
    $sql = "
        INSERT INTO info_scrapping_amazon
        (ean, modelo, url, title, price, mainImage, allMainImages, description, `desc`, desc2)
        VALUES
        ('$ean', '$modelo', '$url', '$title', $price, '$mainImage', '$allMainImages', '$description', '$desc', '$desc2')
    ";

    // ===== Ejecutar query con misma lógica que el primer PHP =====
    $stmt = $conn->execute_query($sql, "conexion");

    if ($stmt >= 0) {
        $insertados++;
    } else {
        $errores++;
        $detallesErrores[] = "Archivo $fileName (EAN: $ean) error en la inserción.";
    }
}

// ===== Respuesta final =====
echo json_encode([
    'success' => $errores === 0,
    'message' => $errores === 0
        ? "✅ Proceso completado correctamente."
        : "⚠️ Proceso finalizado con algunos errores.",
    'archivos_procesados' => count($files),
    'insertados' => $insertados,
    'errores' => $errores,
    'detalles_errores' => $detallesErrores
]);

$conn->close();
exit;
