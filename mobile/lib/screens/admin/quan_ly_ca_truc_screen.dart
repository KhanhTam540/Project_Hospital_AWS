import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../auth/auth_provider.dart';
import '../../services/api_client.dart';

// (Giá»¯ nguyÃªn cÃ¡c hÃ m helper API: getAllShifts, createShift, updateShift, deleteShift)
final ApiClient _api = ApiClient();
Future<List<Map<String, dynamic>>> getAllShifts() async {
  try {
    final response = await _api.get('/catruc');
    if (response.statusCode == 200) {
      return _api.listDataOf(response);
    }
    return [];
  } catch (e) {
    debugPrint('Lá»—i táº£i ca trá»±c: $e');
    return [];
  }
}

Future<bool> createShift(Map<String, dynamic> data) async {
  try {
    final response = await _api.post('/catruc', data);
    return response.statusCode == 200 || response.statusCode == 201;
  } catch (e) {
    debugPrint('Lá»—i táº¡o ca trá»±c: $e');
    return false;
  }
}

Future<bool> updateShift(String maCa, Map<String, dynamic> data) async {
  try {
    final response = await _api.put('/catruc/$maCa', data);
    return response.statusCode == 200 || response.statusCode == 204;
  } catch (e) {
    debugPrint('Lá»—i cáº­p nháº­t ca trá»±c: $e');
    return false;
  }
}

Future<bool> deleteShift(String maCa) async {
  try {
    final response = await _api.delete('/catruc/$maCa');
    return response.statusCode == 200 || response.statusCode == 204;
  } catch (e) {
    debugPrint('Lá»—i xÃ³a ca trá»±c: $e');
    return false;
  }
}

class QuanLyCaTrucPageScreen extends StatefulWidget {
  const QuanLyCaTrucPageScreen({super.key});

  @override
  State<QuanLyCaTrucPageScreen> createState() => _QuanLyCaTrucPageScreenState();
}

class _QuanLyCaTrucPageScreenState extends State<QuanLyCaTrucPageScreen> {
  final _formKey = GlobalKey<FormState>();

  final _tenCaController = TextEditingController();
  final _batDauController = TextEditingController(text: '08:00');
  final _ketThucController = TextEditingController(text: '17:00');

  List<Map<String, dynamic>> _shifts = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchShifts();
  }

  @override
  void dispose() {
    _tenCaController.dispose();
    _batDauController.dispose();
    _ketThucController.dispose();
    super.dispose();
  }

  Future<void> _fetchShifts() async {
    if (!mounted) {
      return;
    }
    setState(() => _isLoading = true);

    final list = await getAllShifts();
    if (!mounted) {
      return;
    }

    setState(() {
      _shifts = list;
      _isLoading = false;
    });
  }

  Future<void> _handleCreateShift() async {
    if (!_formKey.currentState!.validate()) return;

    final success = await createShift({
      'tenCa': _tenCaController.text,
      'thoiGianBatDau': '${_batDauController.text}:00',
      'thoiGianKetThuc': '${_ketThucController.text}:00',
    });

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('âœ… Táº¡o ca trá»±c thÃ nh cÃ´ng'),
          backgroundColor: Colors.green,
        ),
      );
      _tenCaController.clear();
      _batDauController.text = '08:00';
      _ketThucController.text = '17:00';
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('âŒ Táº¡o ca trá»±c tháº¥t báº¡i'),
          backgroundColor: Colors.red,
        ),
      );
    }
    await _fetchShifts();
  }

  // (HÃ m _handleUpdateShift vÃ  _handleDeleteShift giá»¯ nguyÃªn)
  Future<void> _handleUpdateShift(Map<String, dynamic> shift) async {
    var tenCa = shift['tenCa']?.toString() ?? '';
    var batDau = _displayTime(shift['thoiGianBatDau']);
    var ketThuc = _displayTime(shift['thoiGianKetThuc']);

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text('Sá»­a ca trá»±c: ${shift['maCa']}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                initialValue: tenCa,
                onChanged: (value) => tenCa = value,
                decoration: const InputDecoration(labelText: 'TÃªn ca'),
              ),
              const SizedBox(height: 10),
              TextFormField(
                initialValue: batDau,
                onChanged: (value) => batDau = value,
                decoration: const InputDecoration(
                  labelText: 'Giá» báº¯t Ä‘áº§u (HH:mm)',
                ),
              ),
              const SizedBox(height: 10),
              TextFormField(
                initialValue: ketThuc,
                onChanged: (value) => ketThuc = value,
                decoration: const InputDecoration(
                  labelText: 'Giá» káº¿t thÃºc (HH:mm)',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Há»§y'),
            ),
            TextButton(
              onPressed: () async {
                Navigator.pop(dialogContext);

                final success =
                    await updateShift(shift['maCa']?.toString() ?? '', {
                      'tenCa': tenCa.trim(),
                      'thoiGianBatDau': _apiTime(batDau),
                      'thoiGianKetThuc': _apiTime(ketThuc),
                    });

                if (!mounted) {
                  return;
                }

                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      success
                          ? 'Cáº­p nháº­t ca trá»±c thÃ nh cÃ´ng.'
                          : 'Cáº­p nháº­t ca trá»±c tháº¥t báº¡i.',
                    ),
                    backgroundColor: success ? Colors.green : Colors.red,
                  ),
                );
                await _fetchShifts();
              },
              child: const Text('LÆ°u'),
            ),
          ],
        );
      },
    );
  }

  String _displayTime(Object? value) {
    final text = value?.toString() ?? '';
    return text.length >= 5 ? text.substring(0, 5) : text;
  }

  String _apiTime(String value) {
    final normalized = value.trim();
    return normalized.length == 5 ? '$normalized:00' : normalized;
  }

  Future<void> _handleDeleteShift(String maCa) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('XÃ¡c nháº­n xÃ³a'),
        content: Text('Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a ca trá»±c $maCa?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Há»§y'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('XÃ³a', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final success = await deleteShift(maCa);
      if (!mounted) return;
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('ðŸ—‘ï¸ ÄÃ£ xÃ³a ca trá»±c $maCa')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('âŒ XÃ³a tháº¥t báº¡i'),
            backgroundColor: Colors.red,
          ),
        );
      }
      await _fetchShifts();
    }
  }

  @override
  Widget build(BuildContext context) {
    // THIáº¾T Káº¾ Láº I THEO áº¢NH
    return Scaffold(
      backgroundColor: Color(0xFFF4F7F6), // MÃ u ná»n xÃ¡m nháº¡t
      appBar: AppBar(
        title: const Text('Quáº£n lÃ½ ca trá»±c'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        leading: IconButton(
          icon: FaIcon(
            FontAwesomeIcons.chevronLeft,
            color: Colors.white,
            size: 20,
          ),
          onPressed: () => context.go('/admin'), // LuÃ´n quay vá» trang chá»§
        ),
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chá»§',
            onPressed: () => context.go('/admin'),
          ),
          IconButton(
            icon: FaIcon(
              FontAwesomeIcons.rightFromBracket,
              color: Colors.white,
              size: 20,
            ),
            tooltip: 'ÄÄƒng xuáº¥t',
            onPressed: () async {
              await Provider.of<AuthProvider>(context, listen: false).logout();
              if (!context.mounted) return;
              context.go('/login');
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // TiÃªu Ä‘á» chÃ­nh
            Row(
              children: [
                FaIcon(
                  FontAwesomeIcons.clock,
                  color: Colors.blue[700],
                  size: 28,
                ),
                SizedBox(width: 12),
                Text(
                  'Quáº£n lÃ½ ca trá»±c bá»‡nh viá»‡n',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: Color(0xFF2C3E50),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            SizedBox(height: 20),

            // --- Form ThÃªm Ca Trá»±c ---
            Card(
              elevation: 3,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              child: Container(
                padding: EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          FaIcon(
                            FontAwesomeIcons.plus,
                            size: 18,
                            color: Color(0xFF2C3E50),
                          ),
                          SizedBox(width: 8),
                          Text(
                            'ThÃªm ca trá»±c má»›i',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF2C3E50),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 16),

                      TextFormField(
                        controller: _tenCaController,
                        decoration: InputDecoration(
                          labelText: 'TÃªn ca',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 14,
                          ),
                        ),
                        validator: (v) =>
                            v!.isEmpty ? 'TÃªn ca lÃ  báº¯t buá»™c' : null,
                      ),
                      SizedBox(height: 16),

                      Row(
                        children: [
                          Expanded(
                            child: _buildTimePicker(
                              context,
                              'Giá» báº¯t Ä‘áº§u',
                              _batDauController,
                            ),
                          ),
                          SizedBox(width: 10),
                          Expanded(
                            child: _buildTimePicker(
                              context,
                              'Giá» káº¿t thÃºc',
                              _ketThucController,
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 20),

                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _handleCreateShift,
                          icon: FaIcon(FontAwesomeIcons.plus, size: 16),
                          label: Text('ThÃªm ca'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.blue[600],
                            foregroundColor: Colors.white, // MÃ u chá»¯
                            padding: EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            textStyle: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            SizedBox(height: 30),

            // --- Báº£ng Danh sÃ¡ch Ca Trá»±c ---
            Text(
              'Danh sÃ¡ch Ca Trá»±c',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: Color(0xFF2C3E50),
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: 10),

            if (_isLoading)
              Center(child: CircularProgressIndicator())
            else
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                clipBehavior: Clip.antiAlias, // GiÃºp bo trÃ²n DataTable
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: DataTable(
                    columnSpacing: 25, // TÄƒng khoáº£ng cÃ¡ch
                    horizontalMargin: 12,
                    dataRowMinHeight: 52,
                    dataRowMaxHeight: 52,
                    headingRowColor: WidgetStateProperty.all(Colors.grey[50]),
                    columns: [
                      DataColumn(
                        label: Text(
                          'MÃ£ ca',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                      DataColumn(
                        label: Text(
                          'TÃªn ca',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                      DataColumn(
                        label: Text(
                          'Báº¯t Ä‘áº§u',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                      DataColumn(
                        label: Text(
                          'Káº¿t thÃºc',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                      DataColumn(
                        label: Text(
                          'Thao tÃ¡c',
                          style: TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                    rows: _shifts.map((shift) {
                      return DataRow(
                        cells: [
                          DataCell(Text(shift['maCa']?.toString() ?? '-')),
                          DataCell(Text(shift['tenCa']?.toString() ?? '-')),
                          DataCell(Text(_displayTime(shift['thoiGianBatDau']))),
                          DataCell(
                            Text(_displayTime(shift['thoiGianKetThuc'])),
                          ),
                          DataCell(
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: FaIcon(
                                    FontAwesomeIcons.pen,
                                    size: 16,
                                    color: Colors.blue[700],
                                  ), // Sá»­a icon
                                  onPressed: () => _handleUpdateShift(shift),
                                  tooltip: 'Sá»­a',
                                  splashRadius: 20,
                                ),
                                IconButton(
                                  icon: FaIcon(
                                    FontAwesomeIcons.trashCan,
                                    size: 16,
                                    color: Colors.red[700],
                                  ), // Sá»­a icon
                                  onPressed: () => _handleDeleteShift(
                                    shift['maCa']?.toString() ?? '',
                                  ),
                                  tooltip: 'XÃ³a',
                                  splashRadius: 20,
                                ),
                              ],
                            ),
                          ),
                        ],
                      );
                    }).toList(),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // Sá»¬A Lá»–I 2: Sá»­a láº¡i hÃ m _buildTimePicker
  Widget _buildTimePicker(
    BuildContext context,
    String label,
    TextEditingController controller,
  ) {
    return TextFormField(
      readOnly: true,
      controller: controller, // Sá»­ dá»¥ng controller
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        suffixIcon: Icon(Icons.access_time, color: Colors.grey[600]),
      ),
      onTap: () async {
        final initialTime = TimeOfDay(
          hour: int.parse(controller.text.split(':')[0]),
          minute: int.parse(controller.text.split(':')[1]),
        );

        final TimeOfDay? picked = await showTimePicker(
          context: context,
          initialTime: initialTime,
          builder: (context, child) {
            return MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(alwaysUse24HourFormat: true),
              child: child!,
            );
          },
        );

        if (!mounted || picked == null) {
          return;
        }

        final newTime =
            '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
        setState(() {
          controller.text = newTime;
        });
      },
    );
  }
}
