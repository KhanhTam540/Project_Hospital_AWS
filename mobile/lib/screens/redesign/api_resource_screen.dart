import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../models/api_resource_definition.dart';
import '../../services/hospital_api_service.dart';
import '../../widgets/hospital_ui.dart';

class ApiResourceScreen extends StatefulWidget {
  const ApiResourceScreen({super.key, required this.definition});

  final ApiResourceDefinition definition;

  @override
  State<ApiResourceScreen> createState() => _ApiResourceScreenState();
}

class _ApiResourceScreenState extends State<ApiResourceScreen> {
  final HospitalApiService _service = HospitalApiService();
  final TextEditingController _searchController = TextEditingController();

  bool _loading = true;
  String? _error;
  String _query = '';
  List<Map<String, dynamic>> _items = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final auth = context.read<AuthProvider>();
      final endpoint = widget.definition.endpoint(auth);
      final items = await _service.getCollection(endpoint);
      if (!mounted) return;
      setState(() => _items = items);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _visibleItems {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return _items;
    return _items.where((item) {
      final haystack = item.values
          .map((value) => value.toString())
          .join(' ')
          .toLowerCase();
      return haystack.contains(query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final endpoint = widget.definition.endpoint(auth);
    final visibleItems = _visibleItems;

    return HospitalPage(
      onRefresh: _load,
      children: [
        PageHeader(
          title: widget.definition.title,
          subtitle: widget.definition.subtitle,
          icon: widget.definition.icon,
          badge: EndpointBadge(
            method: widget.definition.method,
            path: endpoint,
          ),
          actions: [
            OutlinedButton.icon(
              onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Làm mới'),
            ),
          ],
        ),
        const SizedBox(height: 22),
        SearchField(
          controller: _searchController,
          hint: 'Tìm trong ${widget.definition.title.toLowerCase()}...',
          onChanged: (value) => setState(() => _query = value),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Text(
              '${visibleItems.length} mục',
              style: Theme.of(context).textTheme.labelLarge,
            ),
            const Spacer(),
            Text(
              'Kéo xuống để tải lại',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_loading)
          const LoadingState()
        else if (_error != null)
          ErrorState(message: _error!, onRetry: _load)
        else if (visibleItems.isEmpty)
          EmptyState(
            title: 'Chưa có dữ liệu',
            message: widget.definition.emptyMessage,
            icon: widget.definition.icon,
          )
        else
          ...visibleItems.map((item) {
            final title = firstText(item, widget.definition.primaryKeys);
            final subtitle = firstText(
              item,
              widget.definition.secondaryKeys,
              fallback: 'Nhấn để xem chi tiết',
            );
            final status = firstText(
              item,
              widget.definition.statusKeys,
              fallback: '',
            );
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: DataListTile(
                title: title,
                subtitle: subtitle,
                icon: widget.definition.icon,
                status: status.isEmpty ? null : status,
                onTap: () => showDataDetails(
                  context,
                  title: title,
                  data: item,
                  labels: widget.definition.labels,
                ),
              ),
            );
          }),
      ],
    );
  }
}
