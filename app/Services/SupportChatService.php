<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\ConversationMessage;
use App\Models\User;
use App\Support\UploadedFileUrl;

class SupportChatService
{
    public function pickSupportAgent(): ?User
    {
        $priority = ['staff' => 1, 'manager' => 2, 'super_admin' => 3];

        return User::adminStaff()
            ->where('status', 'active')
            ->with('roles.permissions')
            ->get()
            ->filter(fn (User $user) => $user->hasAdminPermission('chat.manage'))
            ->sortBy(fn (User $user) => $priority[$user->adminRoleName()] ?? 99)
            ->first();
    }

    public function getOrCreateConversation(User $customer): Conversation
    {
        $conversation = Conversation::query()->firstOrCreate(
            ['customer_id' => $customer->id],
            ['support_user_id' => null, 'last_message_at' => null]
        );

        if (! $conversation->support_user_id) {
            $agent = $this->pickSupportAgent();
            if ($agent) {
                $conversation->support_user_id = $agent->id;
                $conversation->save();
            }
        }

        return $conversation->fresh(['supportUser:id,name,email,role', 'customer:id,name,email']);
    }

    public function markVisibleMessagesSeen(Conversation $conversation, User $viewer): void
    {
        ConversationMessage::query()
            ->where('conversation_id', $conversation->id)
            ->where('sender_id', '!=', $viewer->id)
            ->whereNull('seen_at')
            ->update(['seen_at' => now()]);
    }

    public function unreadCountForCustomer(int $customerId): int
    {
        return ConversationMessage::query()
            ->whereHas('conversation', fn ($q) => $q->where('customer_id', $customerId))
            ->where('sender_id', '!=', $customerId)
            ->whereNull('seen_at')
            ->count();
    }

    public function unreadCountForSupport(int $supportUserId): int
    {
        return ConversationMessage::query()
            ->join('conversations', 'conversations.id', '=', 'messages.conversation_id')
            ->where('conversations.support_user_id', $supportUserId)
            ->whereColumn('messages.sender_id', 'conversations.customer_id')
            ->whereNull('messages.seen_at')
            ->count();
    }

    /** Unread customer→support messages across all conversations (admin badge). */
    public function unreadCountAllCustomerMessages(): int
    {
        return ConversationMessage::query()
            ->join('conversations', 'conversations.id', '=', 'messages.conversation_id')
            ->whereColumn('messages.sender_id', 'conversations.customer_id')
            ->whereNull('messages.seen_at')
            ->count();
    }

    public function unreadCustomerMessagesForConversation(int $conversationId): int
    {
        return ConversationMessage::query()
            ->join('conversations', 'conversations.id', '=', 'messages.conversation_id')
            ->where('messages.conversation_id', $conversationId)
            ->whereColumn('messages.sender_id', 'conversations.customer_id')
            ->whereNull('messages.seen_at')
            ->count();
    }

    /**
     * @return array<string, mixed>
     */
    public function formatMessage(ConversationMessage $message): array
    {
        $message->loadMissing('sender:id,name');

        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'body' => $message->body,
            'image_url' => UploadedFileUrl::make($message->image_path),
            'sender' => [
                'id' => $message->sender->id,
                'name' => $message->sender->name,
            ],
            'seen_at' => $message->seen_at?->toIso8601String(),
            'created_at' => $message->created_at->toIso8601String(),
            'client_temp_id' => $message->client_temp_id,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function formatConversation(Conversation $conversation): array
    {
        return [
            'id' => $conversation->id,
            'customer_id' => $conversation->customer_id,
            'support_user_id' => $conversation->support_user_id,
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
        ];
    }
}
