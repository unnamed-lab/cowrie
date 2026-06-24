// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ConfidentialPoolBase} from "../base/ConfidentialPoolBase.sol";

/// @title PayrollStreams (confidential payroll)
/// @notice The employer (organizer) funds the pool and sets an encrypted salary
///         per employee; each employee pulls their salary once per period.
///         Employees can decrypt only their own payslip; the employer can audit.
contract PayrollStreams is ConfidentialPoolBase {
    /// @notice Human-readable payroll title (e.g. "Acme Engineering — monthly").
    string public title;
    /// @notice Optional description (team, terms, notes).
    string public description;
    /// @notice Seconds an employee must wait between claims.
    uint256 public period;

    mapping(address => euint64) private _salary;
    mapping(address => uint256) public lastClaim;
    mapping(address => bool) public isEmployee;
    address[] public employees;

    /// @notice Aggregate totals for accountability: total ever funded and total
    ///         ever claimed. Publicly decryptable (encrypted on-chain); the pool's
    ///         remaining balance is funded − collected. Individual salaries stay private.
    euint64 private _funded;
    euint64 private _collected;

    /// @notice Permanently stopped (tombstone). Blocks further claims.
    bool public dissolved;

    event SalarySet(address indexed employee);
    event Funded(address indexed organizer);
    event Claimed(address indexed employee, uint256 at);
    event EmployeeRemoved(address indexed employee);
    event Dissolved(address indexed organizer);

    constructor(
        address token_,
        address organizer_,
        uint256 period_,
        string memory title_,
        string memory description_
    ) ConfidentialPoolBase(token_, organizer_) {
        period = period_;
        title = title_;
        description = description_;
        _funded = FHE.asEuint64(0);
        _collected = FHE.asEuint64(0);
        FHE.allowThis(_funded);
        FHE.allowThis(_collected);
        FHE.makePubliclyDecryptable(_funded);
        FHE.makePubliclyDecryptable(_collected);
    }

    /// @notice Employer deposits payroll funds (must have approved this pool as operator).
    function fund(externalEuint64 enc, bytes calldata proof) external onlyOrganizer {
        euint64 amount = _ingest(enc, proof);
        euint64 moved = _pull(msg.sender, amount);
        _funded = FHE.add(_funded, moved);
        FHE.allowThis(_funded);
        FHE.makePubliclyDecryptable(_funded);
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
    /// @notice Dispute tool: remove an employee so they can no longer claim (organizer).
    function removeEmployee(address employee) external onlyOrganizer {
        require(isEmployee[employee], "not an employee");
        isEmployee[employee] = false;
        emit EmployeeRemoved(employee);
    }

    /// @notice Dispute / wind-down: stop the payroll and reclaim the unspent pool
    ///         balance back to the employer (organizer). Blocks further claims.
    function stopAndReclaim() external onlyOrganizer {
        require(!dissolved, "dissolved");
        dissolved = true;
        _push(organizer, token.confidentialBalanceOf(address(this)));
        emit Dissolved(organizer);
    }

    function claim() external {
        require(!dissolved, "payroll stopped");
        require(isEmployee[msg.sender], "not an employee");
        require(block.timestamp >= lastClaim[msg.sender] + period, "too soon");
        lastClaim[msg.sender] = block.timestamp;
        euint64 moved = _push(msg.sender, _salary[msg.sender]);
        FHE.allowThis(moved);
        _collected = FHE.add(_collected, moved);
        FHE.allowThis(_collected);
        FHE.makePubliclyDecryptable(_collected);
        emit Claimed(msg.sender, block.timestamp);
    }

    /// @notice Encrypted salary handle. Only ACL-permitted addresses can decrypt it.
    function salaryOf(address employee) external view returns (euint64) {
        return _salary[employee];
    }

    function employeeCount() external view returns (uint256) {
        return employees.length;
    }

    /// @notice Handle of total funds ever deposited (publicly decryptable).
    function fundedHandle() external view returns (bytes32) {
        return FHE.toBytes32(_funded);
    }

    /// @notice Handle of total salaries ever claimed (publicly decryptable).
    function collectedHandle() external view returns (bytes32) {
        return FHE.toBytes32(_collected);
    }
}
