<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StaffWelcomeNotification extends Notification
{
    use Queueable;

    private string $temporaryPassword;

    public function __construct(string $temporaryPassword)
    {
        $this->temporaryPassword = $temporaryPassword;
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your LaLaPick staff account is ready')
            ->greeting("Hello {$notifiable->name},")
            ->line('A staff account has been created for you.')
            ->line('Login email: '.$notifiable->email)
            ->line('Temporary password: '.$this->temporaryPassword)
            ->action('Open admin login', url('/admin/login'))
            ->line('Please change your password after signing in.');
    }
}
