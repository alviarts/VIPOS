package id.alviarts.vipos.feature.pos.data

import javax.inject.Inject

/**
 * Repository for customer operations in the POS flow (P3-16).
 */
interface CustomerRepository {
    suspend fun search(query: String): Result<List<CustomerDto>>
    suspend fun quickAdd(name: String, phone: String?): Result<CustomerDto>
    suspend fun getById(id: Long): Result<CustomerDto>
}

class DefaultCustomerRepository @Inject constructor(
    private val api: PosApi,
) : CustomerRepository {

    override suspend fun search(query: String): Result<List<CustomerDto>> = runCatching {
        api.searchCustomers(search = query.ifBlank { null }).data
    }

    override suspend fun quickAdd(name: String, phone: String?): Result<CustomerDto> = runCatching {
        api.createCustomer(CustomerCreateRequestDto(name = name, phone = phone))
    }

    override suspend fun getById(id: Long): Result<CustomerDto> = runCatching {
        api.getCustomer(id)
    }
}
