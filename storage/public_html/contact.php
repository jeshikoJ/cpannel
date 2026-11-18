<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
    $message = htmlspecialchars($_POST['message'] ?? '');
    
    echo json_encode([
        'status' => 'success',
        'message' => 'Thank you for reaching out! Your message has been queued.'
    ]);
    exit;
}

echo json_encode(['status' => 'error', 'message' => 'Invalid request']);
