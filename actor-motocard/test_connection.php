<?php

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once '../../vendor/autoload.php';
use Baseinn\DB_connect;

$conn = new DB_connect('MARIADB', 0);

if (!$conn) {
    die("❌ Error: no se pudo conectar a la base de datos.");
}

echo "✅ Conexión OK con DB_connect<br><br>";

// Verificar qué tiene la clase
echo "<pre>";
var_dump($conn);
echo "</pre>";

// Intentar obtener la conexión real
if (isset($conn->db)) {
    echo "Detectada propiedad 'db'.<br>";
    $db = $conn->db;
} elseif (method_exists($conn, 'getConnection')) {
    echo "Detectado método getConnection().<br>";
    $db = $conn->getConnection();
} else {
    die("❌ No se encontró cómo acceder al objeto mysqli/PDO dentro de DB_connect.");
}

// Ahora ejecutar una consulta de prueba
$sql = "SELECT * FROM info_scrapping LIMIT 5";

if ($db instanceof mysqli) {
    $result = $db->query($sql);
    if ($result === false) {
        die("❌ Error en la consulta: " . $db->error);
    }

    if ($result->num_rows > 0) {
        echo "✅ La tabla 'info_scrapping' existe y contiene datos:<br><br>";
        while ($row = $result->fetch_assoc()) {
            echo htmlspecialchars(json_encode($row)) . "<br>";
        }
    } else {
        echo "⚠️ La tabla 'info_scrapping' existe pero está vacía.";
    }
} else {
    die("❌ El objeto devuelto no es una conexión mysqli.");
}

?>
