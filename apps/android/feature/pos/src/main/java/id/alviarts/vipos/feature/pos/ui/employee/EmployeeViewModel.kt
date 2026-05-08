package id.alviarts.vipos.feature.pos.ui.employee

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.alviarts.vipos.feature.pos.data.EmployeeCreateRequestDto
import id.alviarts.vipos.feature.pos.data.EmployeeDto
import id.alviarts.vipos.feature.pos.data.EmployeeUpdateRequestDto
import id.alviarts.vipos.feature.pos.data.PosApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for employee management (P4-08).
 * 
 * Features:
 * - List employees with filters
 * - Create new employee
 * - Update employee
 * - Delete employee
 * - Filter by status and department
 */
@HiltViewModel
class EmployeeViewModel @Inject constructor(
    private val posApi: PosApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(EmployeeUiState())
    val uiState: StateFlow<EmployeeUiState> = _uiState.asStateFlow()

    init {
        loadEmployees()
    }

    fun loadEmployees(
        status: String? = null,
        departmentId: Long? = null,
        search: String? = null,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            try {
                val employees = posApi.getEmployees(
                    status = status,
                    departmentId = departmentId,
                    search = search,
                )

                _uiState.update {
                    it.copy(
                        isLoading = false,
                        employees = employees,
                        selectedStatus = status,
                        selectedDepartmentId = departmentId,
                        searchQuery = search,
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

    fun loadEmployeeDetail(employeeId: Long) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoadingDetail = true, error = null) }

            try {
                val employee = posApi.getEmployeeDetail(employeeId = employeeId)

                _uiState.update {
                    it.copy(
                        isLoadingDetail = false,
                        currentEmployee = employee,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoadingDetail = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun createEmployee(
        request: EmployeeCreateRequestDto,
        onSuccess: (Long) -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isCreating = true, error = null) }

            try {
                val created = posApi.createEmployee(request)
                _uiState.update { it.copy(isCreating = false) }
                // Refresh list
                loadEmployees()
                onSuccess(created.id)
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isCreating = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun updateEmployee(
        employeeId: Long,
        request: EmployeeUpdateRequestDto,
        onSuccess: () -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isUpdating = true, error = null) }

            try {
                val updated = posApi.updateEmployee(employeeId = employeeId, request = request)
                _uiState.update {
                    it.copy(
                        isUpdating = false,
                        currentEmployee = updated,
                    )
                }
                // Refresh list
                loadEmployees()
                onSuccess()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isUpdating = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun deleteEmployee(
        employeeId: Long,
        onSuccess: () -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isDeleting = true, error = null) }

            try {
                posApi.deleteEmployee(employeeId = employeeId)
                _uiState.update { it.copy(isDeleting = false) }
                // Refresh list
                loadEmployees()
                onSuccess()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isDeleting = false,
                        error = e.message ?: "Terjadi kesalahan"
                    )
                }
            }
        }
    }

    fun filterByStatus(status: String?) {
        loadEmployees(
            status = status,
            departmentId = _uiState.value.selectedDepartmentId,
            search = _uiState.value.searchQuery,
        )
    }

    fun filterByDepartment(departmentId: Long?) {
        loadEmployees(
            status = _uiState.value.selectedStatus,
            departmentId = departmentId,
            search = _uiState.value.searchQuery,
        )
    }

    fun search(query: String?) {
        loadEmployees(
            status = _uiState.value.selectedStatus,
            departmentId = _uiState.value.selectedDepartmentId,
            search = query,
        )
    }

    fun clearFilters() {
        loadEmployees()
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    fun clearCurrentEmployee() {
        _uiState.update { it.copy(currentEmployee = null) }
    }
}

data class EmployeeUiState(
    val isLoading: Boolean = false,
    val isLoadingDetail: Boolean = false,
    val isCreating: Boolean = false,
    val isUpdating: Boolean = false,
    val isDeleting: Boolean = false,
    val employees: List<EmployeeDto> = emptyList(),
    val currentEmployee: EmployeeDto? = null,
    val selectedStatus: String? = null,
    val selectedDepartmentId: Long? = null,
    val searchQuery: String? = null,
    val error: String? = null,
)
