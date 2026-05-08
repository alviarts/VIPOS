package id.alviarts.vipos.feature.pos.ui.appointment

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.AppointmentActionRequestDto
import id.alviarts.vipos.feature.pos.data.AppointmentCreateRequestDto
import id.alviarts.vipos.feature.pos.data.AppointmentDto
import id.alviarts.vipos.feature.pos.data.PosApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for appointment/reservation management (P4-02).
 * 
 * Features:
 * - List appointments with filters (status, date range, staff)
 * - View appointment details
 * - Create new appointments
 * - State transitions: PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
 * - Cancel/No-show appointments
 * - Reschedule appointments
 */
@HiltViewModel
class AppointmentViewModel @Inject constructor(
    private val posApi: PosApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AppointmentUiState())
    val uiState: StateFlow<AppointmentUiState> = _uiState.asStateFlow()

    private val _detailState = MutableStateFlow(AppointmentDetailState())
    val detailState: StateFlow<AppointmentDetailState> = _detailState.asStateFlow()

    init {
        loadAppointments()
    }

    fun loadAppointments(
        status: String? = null,
        staffId: Long? = null,
        dateFrom: String? = null,
        dateTo: String? = null,
        page: Int = 1,
        limit: Int = 20,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val response = posApi.listAppointments(
                    status = status,
                    staffId = staffId,
                    dateFrom = dateFrom,
                    dateTo = dateTo,
                    page = page,
                    limit = limit,
                )

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        appointments = if (page == 1) {
                            response.data
                        } else {
                            it.appointments + response.data
                        },
                        total = response.total,
                        currentPage = page,
                        hasMore = response.data.size >= limit,
                        selectedStatus = status,
                        selectedStaffId = staffId,
                        dateFrom = dateFrom,
                        dateTo = dateTo,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun loadMore() {
        val state = _uiState.value
        if (!state.isLoading && state.hasMore) {
            loadAppointments(
                status = state.selectedStatus,
                staffId = state.selectedStaffId,
                dateFrom = state.dateFrom,
                dateTo = state.dateTo,
                page = state.currentPage + 1,
                limit = 20,
            )
        }
    }

    fun filterByStatus(status: String?) {
        loadAppointments(
            status = status,
            staffId = _uiState.value.selectedStaffId,
            dateFrom = _uiState.value.dateFrom,
            dateTo = _uiState.value.dateTo,
        )
    }

    fun filterByStaff(staffId: Long?) {
        loadAppointments(
            status = _uiState.value.selectedStatus,
            staffId = staffId,
            dateFrom = _uiState.value.dateFrom,
            dateTo = _uiState.value.dateTo,
        )
    }

    fun filterByDateRange(dateFrom: String?, dateTo: String?) {
        loadAppointments(
            status = _uiState.value.selectedStatus,
            staffId = _uiState.value.selectedStaffId,
            dateFrom = dateFrom,
            dateTo = dateTo,
        )
    }

    fun clearFilters() {
        loadAppointments()
    }

    fun loadAppointmentDetail(id: Long) {
        viewModelScope.launch {
            _detailState.update { it.copy(isLoading = true, error = null) }

            try {
                val appointment = posApi.getAppointmentDetail(id)
                _detailState.update {
                    it.copy(
                        isLoading = false,
                        appointment = appointment
                    )
                }
            } catch (e: Exception) {
                _detailState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun createAppointment(request: AppointmentCreateRequestDto, onSuccess: (AppointmentDto) -> Unit) {
        viewModelScope.launch {
            _detailState.update { it.copy(isLoading = true, error = null) }

            try {
                val appointment = posApi.createAppointment(request)
                _detailState.update { it.copy(isLoading = false) }
                // Refresh list
                loadAppointments()
                onSuccess(appointment)
            } catch (e: Exception) {
                _detailState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun confirmAppointment(id: Long) {
        performAction(id, "confirm", null)
    }

    fun startAppointment(id: Long) {
        performAction(id, "start", null)
    }

    fun completeAppointment(id: Long) {
        performAction(id, "complete", null)
    }

    fun cancelAppointment(id: Long, reason: String?) {
        performAction(id, "cancel", reason)
    }

    fun markNoShow(id: Long, reason: String?) {
        performAction(id, "no-show", reason)
    }

    fun rescheduleAppointment(id: Long, newStartAt: String, newDurationMinutes: Int?) {
        viewModelScope.launch {
            _detailState.update { it.copy(isLoading = true, error = null) }

            val request = AppointmentActionRequestDto(
                newStartAt = newStartAt,
                newDurationMinutes = newDurationMinutes
            )

            try {
                val appointment = posApi.rescheduleAppointment(id, request)
                _detailState.update {
                    it.copy(
                        isLoading = false,
                        appointment = appointment
                    )
                }
                // Refresh list
                loadAppointments()
            } catch (e: Exception) {
                _detailState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    private fun performAction(id: Long, action: String, reason: String?) {
        viewModelScope.launch {
            _detailState.update { it.copy(isLoading = true, error = null) }

            try {
                val appointment = when (action) {
                    "confirm" -> posApi.confirmAppointment(id)
                    "start" -> posApi.startAppointment(id)
                    "complete" -> posApi.completeAppointment(id)
                    "cancel" -> {
                        val request = reason?.let { AppointmentActionRequestDto(reason = it) }
                        posApi.cancelAppointment(id, request)
                    }
                    "no-show" -> {
                        val request = reason?.let { AppointmentActionRequestDto(reason = it) }
                        posApi.markNoShow(id, request)
                    }
                    else -> throw IllegalArgumentException("Unknown action: $action")
                }

                _detailState.update {
                    it.copy(
                        isLoading = false,
                        appointment = appointment
                    )
                }
                // Refresh list
                loadAppointments()
            } catch (e: Exception) {
                _detailState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun clearDetailError() {
        _detailState.update { it.copy(error = null) }
    }

    fun clearListError() {
        _uiState.update { it.copy(error = null) }
    }
}

data class AppointmentUiState(
    val isLoading: Boolean = false,
    val appointments: List<AppointmentDto> = emptyList(),
    val total: Int = 0,
    val currentPage: Int = 1,
    val hasMore: Boolean = false,
    val selectedStatus: String? = null,
    val selectedStaffId: Long? = null,
    val dateFrom: String? = null,
    val dateTo: String? = null,
    val error: String? = null,
)

data class AppointmentDetailState(
    val isLoading: Boolean = false,
    val appointment: AppointmentDto? = null,
    val error: String? = null,
)
