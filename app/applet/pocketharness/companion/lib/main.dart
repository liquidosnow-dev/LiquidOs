import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const PocketHarnessApp());
}

class PocketHarnessApp extends StatelessWidget {
  const PocketHarnessApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PocketHarness // BYOK AI Gateway',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF10B981),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const HarnessConsoleScreen(),
    );
  }
}

class HarnessConsoleScreen extends StatefulWidget {
  const HarnessConsoleScreen({super.key});

  @override
  State<HarnessConsoleScreen> createState() => _HarnessConsoleScreenState();
}

class _HarnessConsoleScreenState extends State<HarnessConsoleScreen> {
  final TextEditingController _bridgeUrlController =
      TextEditingController(text: 'http://127.0.0.1:8787');
  final TextEditingController _tokenController =
      TextEditingController(text: 'dev-token');
  final TextEditingController _byokKeyController = TextEditingController();
  final TextEditingController _promptController = TextEditingController();

  final List<String> _models = const [
    'anthropic/claude-sonnet-4-5',
    'openai/gpt-4o',
    'google/gemini-2.5-pro',
    'xai/grok-3',
  ];

  String _selectedModel = 'anthropic/claude-sonnet-4-5';
  bool _requireApproval = true;
  bool _isLoading = false;
  bool _isStreaming = false;
  String _gatewayMode = 'UNKNOWN';
  bool _bridgeOnline = false;
  String _streamingOutput = '';
  List<Map<String, dynamic>> _tasks = [];
  StreamSubscription<String>? _streamSub;

  @override
  void initState() {
    super.initState();
    _refreshBridgeState();
  }

  @override
  void dispose() {
    _streamSub?.cancel();
    super.dispose();
  }

  Map<String, String> get _authHeaders {
    final headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${_tokenController.text.trim()}',
    };
    final byok = _byokKeyController.text.trim();
    if (byok.isNotEmpty) {
      headers['X-BYOK-Key'] = byok;
    }
    return headers;
  }

  Future<void> _refreshBridgeState() async {
    final baseUrl = _bridgeUrlController.text.trim();
    try {
      final healthRes = await http
          .get(Uri.parse('$baseUrl/health'), headers: _authHeaders)
          .timeout(const Duration(seconds: 3));
      if (healthRes.statusCode == 200) {
        final healthData = jsonDecode(healthRes.body) as Map<String, dynamic>;
        final tasksRes = await http.get(
          Uri.parse('$baseUrl/v1/harness/tasks'),
          headers: _authHeaders,
        );
        final List<Map<String, dynamic>> fetchedTasks = [];
        if (tasksRes.statusCode == 200) {
          final parsed = jsonDecode(tasksRes.body) as Map<String, dynamic>;
          for (final item in (parsed['tasks'] as List? ?? [])) {
            fetchedTasks.add(Map<String, dynamic>.from(item as Map));
          }
        }
        setState(() {
          _bridgeOnline = true;
          _gatewayMode = healthData['gatewayMode']?.toString() ?? 'ACTIVE';
          _tasks = fetchedTasks;
        });
      } else {
        setState(() => _bridgeOnline = false);
      }
    } catch (_) {
      setState(() => _bridgeOnline = false);
    }
  }

  Future<void> _submitPrompt() async {
    final prompt = _promptController.text.trim();
    if (prompt.isEmpty || _isLoading || _isStreaming) return;

    if (!_requireApproval) {
      await _startSseStream(prompt);
      return;
    }

    setState(() => _isLoading = true);
    final baseUrl = _bridgeUrlController.text.trim();
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/v1/harness/propose'),
        headers: _authHeaders,
        body: jsonEncode({
          'prompt': prompt,
          'model': _selectedModel,
          'requiresApproval': true,
        }),
      );
      if (res.statusCode == 200 || res.statusCode == 202) {
        _promptController.clear();
        await _refreshBridgeState();
      } else {
        _showSnack('Bridge error (${res.statusCode}): ${res.body}');
      }
    } catch (e) {
      _showSnack('Connection failed: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _startSseStream(String prompt) async {
    setState(() {
      _isStreaming = true;
      _streamingOutput = '';
    });

    final baseUrl = _bridgeUrlController.text.trim();
    final uri = Uri.parse('$baseUrl/v1/harness/stream')
        .replace(queryParameters: {'prompt': prompt, 'model': _selectedModel});

    try {
      final request = http.Request('GET', uri);
      request.headers.addAll(_authHeaders);
      final client = http.Client();
      final streamedResponse = await client.send(request);

      if (streamedResponse.statusCode != 200) {
        _showSnack('SSE Stream error (${streamedResponse.statusCode})');
        setState(() => _isStreaming = false);
        return;
      }

      _streamSub = streamedResponse.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen((line) {
        if (line.startsWith('data: ')) {
          final jsonStr = line.substring(6).trim();
          try {
            final data = jsonDecode(jsonStr) as Map<String, dynamic>;
            final type = data['type'];
            if (type == 'token' || type == 'start') {
              final text = data['text']?.toString() ?? '';
              setState(() {
                _streamingOutput += text;
              });
            } else if (type == 'error') {
              setState(() {
                _streamingOutput += '\n[Error: ${data['text']}]';
              });
            } else if (type == 'done') {
              _showSnack('SSE Stream complete with Ed25519 signature receipt');
              _refreshBridgeState();
            }
          } catch (_) {}
        }
      }, onDone: () {
        if (mounted) setState(() => _isStreaming = false);
      }, onError: (err) {
        _showSnack('Stream error: $err');
        if (mounted) setState(() => _isStreaming = false);
      });
    } catch (e) {
      _showSnack('SSE Connection failed: $e');
      setState(() => _isStreaming = false);
    }
  }

  Future<void> _resolveTask(String taskId, {required bool approve}) async {
    setState(() => _isLoading = true);
    final baseUrl = _bridgeUrlController.text.trim();
    final action = approve ? 'approve' : 'reject';
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/v1/harness/$action/$taskId'),
        headers: _authHeaders,
      );
      if (res.statusCode == 200) {
        await _refreshBridgeState();
      } else {
        _showSnack('Action failed (${res.statusCode}): ${res.body}');
      }
    } catch (e) {
      _showSnack('Network error: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('PocketHarness // BYOK SSE Console'),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Chip(
              avatar: Icon(
                Icons.circle,
                size: 12,
                color: _bridgeOnline ? Colors.greenAccent : Colors.redAccent,
              ),
              label: Text(_bridgeOnline ? _gatewayMode : 'OFFLINE'),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Sync Bridge',
            onPressed: _refreshBridgeState,
          ),
        ],
      ),
      body: Column(
        children: [
          _buildConnectionPanel(),
          _buildComposerPanel(),
          if (_isStreaming) _buildStreamingCard(),
          const Divider(height: 1),
          Expanded(child: _buildTaskFeed()),
        ],
      ),
    );
  }

  Widget _buildConnectionPanel() {
    return ExpansionTile(
      title: const Text('Bridge Connection & BYOK Key'),
      subtitle: Text('URL: ${_bridgeUrlController.text} • BYOK: ${_byokKeyController.text.isEmpty ? "Disabled (Dry-Run)" : "Active"}'),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Column(
            children: [
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: TextField(
                      controller: _bridgeUrlController,
                      decoration: const InputDecoration(
                        labelText: 'Bridge URL',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _tokenController,
                      obscureText: true,
                      decoration: const InputDecoration(
                        labelText: 'Bridge Token',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _byokKeyController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Bring-Your-Own-Key (BYOK) - OpenAI/Anthropic API Key',
                  hintText: 'sk-ant-... or sk-... (Bypasses Gateway Credits)',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildComposerPanel() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _selectedModel,
                  decoration: const InputDecoration(
                    labelText: 'AI Gateway Model',
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: _models
                      .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                      .toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _selectedModel = val);
                  },
                ),
              ),
              const SizedBox(width: 12),
              FilterChip(
                label: const Text('Approval Gate'),
                selected: _requireApproval,
                onSelected: (val) => setState(() => _requireApproval = val),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _promptController,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'Enter instruction for AI Gateway dispatch...',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: (_isLoading || _isStreaming) ? null : _submitPrompt,
            icon: _isLoading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(_requireApproval ? Icons.send : Icons.bolt),
            label: Text(
              _requireApproval
                  ? 'Queue for Approval'
                  : 'Stream Token-by-Token via SSE',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStreamingCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.emerald.shade950.withOpacity(0.3),
        border: Border.all(color: Colors.emeraldAccent.withOpacity(0.5)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              SizedBox(width: 8),
              Text(
                'Live SSE Token-by-Token Stream Active...',
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: Colors.emeraldAccent),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SelectableText(_streamingOutput),
        ],
      ),
    );
  }

  Widget _buildTaskFeed() {
    if (_tasks.isEmpty) {
      return const Center(
        child: Text('No gateway tasks queued yet.'),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _tasks.length,
      itemBuilder: (context, index) {
        final task = _tasks[index];
        final status = task['status']?.toString() ?? 'UNKNOWN';
        final audit = task['audit'] as Map<String, dynamic>?;
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      task['model']?.toString() ?? '',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Badge(
                      label: Text(status),
                      backgroundColor: status == 'EXECUTED' || status == 'STREAMED'
                          ? Colors.green.shade800
                          : status == 'PENDING_APPROVAL'
                              ? Colors.amber.shade900
                              : Colors.red.shade900,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(task['prompt']?.toString() ?? ''),
                if (status == 'PENDING_APPROVAL') ...[
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      OutlinedButton(
                        onPressed: _isLoading
                            ? null
                            : () => _resolveTask(task['taskId'], approve: false),
                        child: const Text('Reject'),
                      ),
                      const SizedBox(width: 8),
                      FilledButton(
                        onPressed: _isLoading
                            ? null
                            : () => _resolveTask(task['taskId'], approve: true),
                        child: const Text('Approve & Spend Credits'),
                      ),
                    ],
                  ),
                ],
                if (task['output'] != null) ...[
                  const Divider(height: 20),
                  SelectableText(task['output'].toString()),
                ],
                if (audit != null) ...[
                  const SizedBox(height: 10),
                  InkWell(
                    onTap: () {
                      Clipboard.setData(
                        ClipboardData(text: audit['signature']?.toString() ?? ''),
                      );
                      _showSnack('Copied Ed25519 signature receipt to clipboard');
                    },
                    child: Row(
                      children: [
                        const Icon(Icons.verified, size: 14, color: Colors.cyanAccent),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            'Ed25519 Signed • ${audit['gatewayMode'] ?? 'GATEWAY'} • ${audit['latencyMs'] ?? 0}ms • Sig:${(audit['signature']?.toString() ?? '').substring(0, 16)}…',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Colors.cyanAccent,
                                ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
