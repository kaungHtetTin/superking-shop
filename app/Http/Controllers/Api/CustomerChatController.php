<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\ConversationMessage;
use App\Services\SupportChatService;
use App\Support\UploadedFileUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CustomerChatController extends Controller
{
    public function overview(Request $request, SupportChatService $supportChatService)
    {
        $conversation = $supportChatService->getOrCreateConversation($request->user());
        $supportChatService->markVisibleMessagesSeen($conversation, $request->user());

        $messages = ConversationMessage::query()
            ->where('conversation_id', $conversation->id)
            ->with('sender:id,name')
            ->orderByDesc('id')
            ->limit(45)
            ->get()
            ->sortBy('id')
            ->values();

        return response()->json([
            'conversation' => $supportChatService->formatConversation($conversation),
            'messages' => $messages->map(fn (ConversationMessage $m) => $supportChatService->formatMessage($m))->all(),
            'counterpart' => $conversation->supportUser ? [
                'id' => $conversation->supportUser->id,
                'name' => $conversation->supportUser->name,
                'role' => $conversation->supportUser->role ?? null,
            ] : null,
        ]);
    }

    public function paginatedMessages(Request $request, Conversation $conversation, SupportChatService $supportChatService)
    {
        abort_unless($conversation->customer_id === $request->user()->id, 403);

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
        $conversation = $supportChatService->getOrCreateConversation($request->user());
        $supportChatService->markVisibleMessagesSeen($conversation, $request->user());

        $afterId = (int) $request->query('after_id', 0);

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
        $validated = $request->validate([
            'body' => ['nullable', 'string', 'max:8000'],
            'client_temp_id' => ['nullable', 'string', 'max:120'],
            'image_path' => ['nullable', 'string', 'max:500'],
        ]);

        $hasImage = ! empty($validated['image_path']);
        $body = isset($validated['body']) ? trim((string) $validated['body']) : '';

        if ($body === '' && ! $hasImage) {
            return response()->json(['message' => 'Message cannot be empty.'], 422);
        }

        $conversation = $supportChatService->getOrCreateConversation($request->user());

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

        $message = ConversationMessage::create([
            'conversation_id' => $conversation->id,
            'sender_id' => $request->user()->id,
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
        $request->validate([
            'image' => ['required', 'file', 'max:10240', 'mimes:jpg,jpeg,png,webp'],
        ]);

        $path = $request->file('image')->store('chat-images', 'public');

        return response()->json([
            'path' => $path,
            'url' => UploadedFileUrl::make($path),
        ]);
    }
}
