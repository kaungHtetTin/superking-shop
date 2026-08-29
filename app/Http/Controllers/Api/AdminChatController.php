<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\ConversationMessage;
use App\Models\User;
use App\Services\SupportChatService;
use App\Support\UploadedFileUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminChatController extends Controller
{
    private function authorizeAdminChat(Request $request): void
    {
        abort_unless($request->user()?->hasAdminPermission('chat.manage'), 403);
    }

    public function unreadCount(Request $request, SupportChatService $supportChatService)
    {
        $this->authorizeAdminChat($request);

        return response()->json([
            'count' => $supportChatService->unreadCountAllCustomerMessages(),
        ]);
    }

    public function index(Request $request, SupportChatService $supportChatService)
    {
        $this->authorizeAdminChat($request);

        $search = trim((string) $request->query('q', ''));

        $query = Conversation::query()
            ->with([
                'customer:id,name,email,phone,avatar',
                'latestMessage.sender:id,name',
            ])
            ->orderByDesc('last_message_at')
            ->orderByDesc('id');

        if ($search !== '') {
            $query->whereHas('customer', function ($q) use ($search) {
                $like = '%'.$search.'%';
                $q->where('name', 'like', $like)->orWhere('email', 'like', $like);
            });
        }

        $page = $query->paginate(min((int) $request->query('per_page', 18), 50));

        $items = collect($page->items())->map(function (Conversation $conversation) use ($supportChatService) {
            $preview = $conversation->latestMessage;

            return [
                'conversation' => $supportChatService->formatConversation($conversation),
                'customer' => [
                    'id' => $conversation->customer->id,
                    'name' => $conversation->customer->name,
                    'email' => $conversation->customer->email,
                    'phone' => $conversation->customer->phone ?? null,
                    'avatar' => $conversation->customer->avatar ?? null,
                ],
                'last_message' => $preview ? $supportChatService->formatMessage($preview) : null,
                'unread_count' => $supportChatService->unreadCustomerMessagesForConversation($conversation->id),
            ];
        })->values()->all();

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function show(Request $request, Conversation $conversation, SupportChatService $supportChatService)
    {
        $this->authorizeAdminChat($request);

        $conversation->load(['customer:id,name,email,phone,avatar', 'supportUser:id,name,role']);
        $supportChatService->markVisibleMessagesSeen($conversation, $request->user());

        return response()->json([
            'conversation' => $supportChatService->formatConversation($conversation),
            'customer' => [
                'id' => $conversation->customer->id,
                'name' => $conversation->customer->name,
                'email' => $conversation->customer->email,
                'phone' => $conversation->customer->phone ?? null,
                'avatar' => $conversation->customer->avatar ?? null,
            ],
            'assigned_support' => $conversation->supportUser ? [
                'id' => $conversation->supportUser->id,
                'name' => $conversation->supportUser->name,
                'role' => $conversation->supportUser->role,
            ] : null,
        ]);
    }

    public function paginatedMessages(Request $request, Conversation $conversation, SupportChatService $supportChatService)
    {
        $this->authorizeAdminChat($request);

        $beforeId = $request->query('before_id');
        $limit = min((int) $request->query('limit', 35), 80);

        $query = ConversationMessage::query()
            ->where('conversation_id', $conversation->id)
            ->with('sender:id,name')
            ->orderByDesc('id')
            ->limit($limit);

        if ($beforeId) {
            $query->where('id', '<', (int) $beforeId);
        }

        $messages = $query->get()->sortBy('id')->values();

        return response()->json([
            'messages' => $messages->map(fn (ConversationMessage $m) => $supportChatService->formatMessage($m))->all(),
            'has_more' => $messages->count() >= $limit,
        ]);
    }

    public function latest(Request $request, SupportChatService $supportChatService)
    {
        $this->authorizeAdminChat($request);

        $validated = $request->validate([
            'conversation_id' => ['required', 'integer', 'exists:conversations,id'],
            'after_id' => ['nullable', 'integer', 'min:0'],
        ]);

        $conversation = Conversation::query()->findOrFail((int) $validated['conversation_id']);
        $supportChatService->markVisibleMessagesSeen($conversation, $request->user());

        $afterId = (int) ($validated['after_id'] ?? 0);

        $messages = ConversationMessage::query()
            ->where('conversation_id', $conversation->id)
            ->where('id', '>', $afterId)
            ->with('sender:id,name')
            ->orderBy('id')
            ->get();

        return response()->json([
            'messages' => $messages->map(fn (ConversationMessage $m) => $supportChatService->formatMessage($m))->all(),
        ]);
    }

    public function send(Request $request, SupportChatService $supportChatService)
    {
        $this->authorizeAdminChat($request);

        $validated = $request->validate([
            'conversation_id' => ['required', 'integer', 'exists:conversations,id'],
            'body' => ['nullable', 'string', 'max:8000'],
            'client_temp_id' => ['nullable', 'string', 'max:120'],
            'image_path' => ['nullable', 'string', 'max:500'],
        ]);

        $hasImage = ! empty($validated['image_path']);
        $body = isset($validated['body']) ? trim((string) $validated['body']) : '';

        if ($body === '' && ! $hasImage) {
            return response()->json(['message' => 'Message cannot be empty.'], 422);
        }

        $conversation = Conversation::query()->findOrFail((int) $validated['conversation_id']);

        if (! empty($validated['client_temp_id'])) {
            $existing = ConversationMessage::query()
                ->where('conversation_id', $conversation->id)
                ->where('client_temp_id', $validated['client_temp_id'])
                ->first();

            if ($existing) {
                return response()->json([
                    'message' => $supportChatService->formatMessage($existing),
                ]);
            }
        }

        if ($hasImage) {
            $diskPath = ltrim($validated['image_path'], '/');
            if (! str_starts_with($diskPath, 'chat-images/')) {
                return response()->json(['message' => 'Invalid image reference.'], 422);
            }
            if (! Storage::disk('public')->exists($diskPath)) {
                return response()->json(['message' => 'Upload expired or missing. Please upload again.'], 422);
            }
        }

        $admin = $request->user();

        if ($conversation->support_user_id === null) {
            $conversation->support_user_id = $admin->id;
            $conversation->save();
        }

        $message = ConversationMessage::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $admin->id,
            'body' => $body !== '' ? $body : null,
            'image_path' => $hasImage ? ltrim($validated['image_path'], '/') : null,
            'seen_at' => null,
            'client_temp_id' => $validated['client_temp_id'] ?? null,
        ]);

        $conversation->forceFill(['last_message_at' => now()])->save();

        $message->load('sender:id,name');

        return response()->json([
            'message' => $supportChatService->formatMessage($message),
        ]);
    }

    public function uploadImage(Request $request)
    {
        $this->authorizeAdminChat($request);

        $request->validate([
            'image' => ['required', 'file', 'max:10240', 'mimes:jpg,jpeg,png,webp'],
        ]);

        $path = $request->file('image')->store('chat-images', 'public');

        return response()->json([
            'path' => $path,
            'url' => UploadedFileUrl::make($path),
        ]);
    }

    /**
     * Resolve (or create) conversation for a customer user id (admin inbox deep-link).
     */
    public function conversationForCustomer(Request $request, User $user, SupportChatService $supportChatService)
    {
        $this->authorizeAdminChat($request);

        $conversation = $supportChatService->getOrCreateConversation($user);

        return $this->show($request, $conversation, $supportChatService);
    }
}
