// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ConfidentialPoolBase} from "../base/ConfidentialPoolBase.sol";

/// @title PayrollStreams (confidential payroll)
/// @notice The employer (organizer) funds the pool and sets an encrypted salary
///         per employee; each employee pulls their salary once per period.
///         Employees can decrypt only their own payslip; the employer can audit.
contract PayrollStreams is ConfidentialPoolBase {
    /// @notice Seconds an employee must wait between claims.
    uint256 public period;

    mapping(address => euint64) private _salary;
    mapping(address => uint256) public lastClaim;
    mapping(address => bool) public isEmployee;
    address[] public employees;

    event SalarySet(address indexed employee);
    event Funded(address indexed organizer);
    event Claimed(address indexed employee, uint256 at);

    constructor(
        address token_,
        address organizer_,
        uint256 period_
    ) ConfidentialPoolBase(token_, organizer_) {
        period = period_;
    }

    /// @notice Employer deposits payroll funds (must have approved this pool as operator).
    function fund(externalEuint64 enc, bytes calldata proof) external onlyOrganizer {
        euint64 amount = _ingest(enc, proof);
        _pull(msg.sender, amount);
        emit Funded(msg.sender);
    }

    /// @notice Set (or update) an employee's encrypted salary.
    function setSalary(address employee, externalEuint64 enc, bytes calldata proof) external onlyOrganizer {
        euint64 salary = _ingest(enc, proof);
        if (!isEmployee[employee]) {
            isEmployee[employee] = true;
            employees.push(employee);
        }
        _salary[employee] = salary;
        FHE.allowThis(salary);
        FHE.allow(salary, employee); // employee decrypts their own payslip
        FHE.allow(salary, organizer); // organizer can audit
        emit SalarySet(employee);
    }

    /// @notice Claim this period's salary. Capped at the pool's available balance.
    function claim() external {
        require(isEmployee[msg.sender], "not an employee");
        require(block.timestamp >= lastClaim[msg.sender] + period, "too soon");
        lastClaim[msg.sender] = block.timestamp;
        _push(msg.sender, _salary[msg.sender]);
        emit Claimed(msg.sender, block.timestamp);
    }

    /// @notice Encrypted salary handle. Only ACL-permitted addresses can decrypt it.
    function salaryOf(address employee) external view returns (euint64) {
        return _salary[employee];
    }

    function employeeCount() external view returns (uint256) {
        return employees.length;
    }
}
