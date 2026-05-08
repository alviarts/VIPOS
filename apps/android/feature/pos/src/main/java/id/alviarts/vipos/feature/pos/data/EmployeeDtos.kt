package id.alviarts.vipos.feature.pos.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Wire DTOs for employee management (P4-08).
 * 
 * Covers:
 * - Employee CRUD
 * - Department assignment
 * - Status management (active, inactive, terminated)
 * - Contact information
 */

@Serializable
data class EmployeeDto(
    @SerialName("id") val id: Long,
    @SerialName("employee_no") val employeeNo: String,
    @SerialName("name") val name: String,
    @SerialName("email") val email: String? = null,
    @SerialName("phone") val phone: String? = null,
    @SerialName("position") val position: String? = null,
    @SerialName("department_id") val departmentId: Long? = null,
    @SerialName("department_name") val departmentName: String? = null,
    @SerialName("status") val status: String, // active, inactive, terminated
    @SerialName("hire_date") val hireDate: String? = null,
    @SerialName("termination_date") val terminationDate: String? = null,
    @SerialName("address") val address: String? = null,
    @SerialName("emergency_contact_name") val emergencyContactName: String? = null,
    @SerialName("emergency_contact_phone") val emergencyContactPhone: String? = null,
    @SerialName("notes") val notes: String? = null,
    @SerialName("payroll_structure_id") val payrollStructureId: Long? = null,
    @SerialName("payroll_structure_name") val payrollStructureName: String? = null,
    @SerialName("attendance_methods") val attendanceMethods: List<String>? = null,
    @SerialName("allowed_outlet_ids") val allowedOutletIds: List<Long>? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
)

@Serializable
data class EmployeeCreateRequestDto(
    @SerialName("name") val name: String,
    @SerialName("email") val email: String? = null,
    @SerialName("phone") val phone: String? = null,
    @SerialName("position") val position: String? = null,
    @SerialName("department_id") val departmentId: Long? = null,
    @SerialName("status") val status: String = "active",
    @SerialName("hire_date") val hireDate: String? = null,
    @SerialName("address") val address: String? = null,
    @SerialName("emergency_contact_name") val emergencyContactName: String? = null,
    @SerialName("emergency_contact_phone") val emergencyContactPhone: String? = null,
    @SerialName("notes") val notes: String? = null,
    @SerialName("payroll_structure_id") val payrollStructureId: Long? = null,
    @SerialName("attendance_methods") val attendanceMethods: List<String>? = null,
    @SerialName("allowed_outlet_ids") val allowedOutletIds: List<Long>? = null,
)

@Serializable
data class EmployeeUpdateRequestDto(
    @SerialName("name") val name: String? = null,
    @SerialName("email") val email: String? = null,
    @SerialName("phone") val phone: String? = null,
    @SerialName("position") val position: String? = null,
    @SerialName("department_id") val departmentId: Long? = null,
    @SerialName("status") val status: String? = null,
    @SerialName("hire_date") val hireDate: String? = null,
    @SerialName("termination_date") val terminationDate: String? = null,
    @SerialName("address") val address: String? = null,
    @SerialName("emergency_contact_name") val emergencyContactName: String? = null,
    @SerialName("emergency_contact_phone") val emergencyContactPhone: String? = null,
    @SerialName("notes") val notes: String? = null,
    @SerialName("payroll_structure_id") val payrollStructureId: Long? = null,
    @SerialName("attendance_methods") val attendanceMethods: List<String>? = null,
    @SerialName("allowed_outlet_ids") val allowedOutletIds: List<Long>? = null,
)
