using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Quanlycongviec.Api.Controllers;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Reports.Commands.EvaluateOfficer;
using Quanlycongviec.Application.Features.Reports.Queries.GetGRADReport;
using Xunit;

namespace Quanlycongviec.Api.IntegrationTests
{
    public class ReportsControllerSecurityTests
    {
        [Fact]
        public async Task EvaluateOfficer_ByStaffRank5_ShouldReturnForbid()
        {
            var staffId = Guid.NewGuid();
            var senderMock = new Mock<ISender>();
            var contextMock = new Mock<IApplicationDbContext>();
            var controller = new ReportsController(senderMock.Object, contextMock.Object)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                        {
                            new Claim(ClaimTypes.NameIdentifier, staffId.ToString()),
                            new Claim("RankLevel", "5")
                        }, "TestAuth"))
                    }
                }
            };

            var dto = new EvaluateOfficerRequestDto
            {
                TargetUserId = Guid.NewGuid(),
                EvaluatorScore70 = 6.0
            };

            var result = await controller.EvaluateOfficer(dto, CancellationToken.None);

            result.Should().BeOfType<ForbidResult>();
            senderMock.Verify(s => s.Send(It.IsAny<EvaluateOfficerCommand>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task GetGRADReport_ByStaffRank5_ShouldReturnForbid()
        {
            var staffId = Guid.NewGuid();
            var senderMock = new Mock<ISender>();
            var contextMock = new Mock<IApplicationDbContext>();
            var controller = new ReportsController(senderMock.Object, contextMock.Object)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                        {
                            new Claim(ClaimTypes.NameIdentifier, staffId.ToString()),
                            new Claim("RankLevel", "5")
                        }, "TestAuth"))
                    }
                }
            };

            var result = await controller.GetGRADReport();

            result.Should().BeOfType<ForbidResult>();
            senderMock.Verify(s => s.Send(It.IsAny<GetGRADReportQuery>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task EvaluateOfficer_ByLeader_ShouldAlwaysUseAuthenticatedUserAsEvaluator()
        {
            var leaderId = Guid.NewGuid();
            var targetUserId = Guid.NewGuid();
            var senderMock = new Mock<ISender>();
            var contextMock = new Mock<IApplicationDbContext>();
            var captured = (EvaluateOfficerCommand?)null;

            senderMock
                .Setup(s => s.Send(It.IsAny<EvaluateOfficerCommand>(), It.IsAny<CancellationToken>()))
                .Callback((IRequest<EvaluateOfficerResultDto> req, CancellationToken _) => captured = (EvaluateOfficerCommand)req)
                .ReturnsAsync(new EvaluateOfficerResultDto
                {
                    Success = true,
                    FinalScore = 9.2,
                    TierGrade = "Hoàn thành xuất sắc nhiệm vụ"
                });

            var controller = new ReportsController(senderMock.Object, contextMock.Object)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                        {
                            new Claim(ClaimTypes.NameIdentifier, leaderId.ToString()),
                            new Claim("RankLevel", "1")
                        }, "TestAuth"))
                    }
                }
            };

            var dto = new EvaluateOfficerRequestDto
            {
                TargetUserId = targetUserId,
                EvaluatorScore70 = 6.8
            };

            var result = await controller.EvaluateOfficer(dto, CancellationToken.None);

            result.Should().BeOfType<OkObjectResult>();
            captured.Should().NotBeNull();
            captured!.EvaluatedByUserId.Should().Be(leaderId);
            captured.TargetUserId.Should().Be(targetUserId);
            captured.EvaluatorScore70.Should().Be(6.8);
        }
    }
}
