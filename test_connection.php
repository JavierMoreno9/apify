<?php

error_reporting(E_ALL);
ini_set('display_errors', 1);


require_once '../vendor/autoload.php';
use Baseinn\DB_connect;
$conn = new DB_connect('MARIADB',0);

if ($conn) {
    echo "Conexión OK con DB_connect";
} else {
    echo "Error: no se pudo conectar a la base de datos.";
}